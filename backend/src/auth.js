import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getDbStatus } from './database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_COOKIE_NAME = 'auth_token';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map();

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set before starting the backend.');
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function issueAuthCookie(res, user) {
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
}

export function readAuthToken(req) {
  const authorization = req.headers['authorization'];
  if (authorization?.startsWith('Bearer ')) {
    return authorization.split(' ')[1];
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const rawCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!rawCookie) {
    return null;
  }

  return decodeURIComponent(rawCookie.slice(`${AUTH_COOKIE_NAME}=`.length));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function getLoginRateLimitKey(req, username) {
  return `${getClientIp(req)}:${(username || '').toLowerCase()}`;
}

function getRetryAfterSeconds(blockedUntil) {
  return Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
}

function ensureLoginAllowed(req, username) {
  const key = getLoginRateLimitKey(req, username);
  const entry = loginAttempts.get(key);
  if (!entry) {
    return { allowed: true, key };
  }

  const now = Date.now();

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      key,
      blockedUntil: entry.blockedUntil
    };
  }

  if (now - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true, key };
  }

  return { allowed: true, key };
}

function recordLoginFailure(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: null
    });
    return;
  }

  const nextCount = current.count + 1;
  loginAttempts.set(key, {
    count: nextCount,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_BLOCK_MS : null
  });
}

function clearLoginFailures(key) {
  loginAttempts.delete(key);
}

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hashedPassword]
    );
    const user = result.rows[0];

    issueAuthCookie(res, user);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Username already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log('Login attempt for:', req.body.username);
  
  if (!getDbStatus()) {
    console.log('Login failed: DB unavailable');
    return res.status(503).json({ message: 'Database service unavailable' });
  }

  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('Login failed: Missing credentials');
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const rateLimit = ensureLoginAllowed(req, username);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(getRetryAfterSeconds(rateLimit.blockedUntil)));
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      recordLoginFailure(rateLimit.key);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      recordLoginFailure(rateLimit.key);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    clearLoginFailures(rateLimit.key);
    const publicUser = { id: user.id, username: user.username, created_at: user.created_at };
    issueAuthCookie(res, publicUser);
    res.json({ user: publicUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update credentials
router.post('/update', verifyToken, async (req, res) => {
  const { newUsername, newPassword, currentPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required to make changes' });
  }

  try {
    // 1. Verify current password
    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 2. Build update query
    let updateFields = [];
    let values = [];
    let counter = 1;

    if (newUsername) {
      updateFields.push(`username = $${counter++}`);
      values.push(newUsername);
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      updateFields.push(`password_hash = $${counter++}`);
      values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    values.push(userId);
    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${counter} RETURNING id, username`;
    
    const result = await query(updateQuery, values);
    const updatedUser = result.rows[0];

    issueAuthCookie(res, updatedUser);

    res.json({ 
      message: 'Credentials updated successfully',
      user: updatedUser
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username already taken' });
    }
    console.error('Update credentials error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
});

// Get Me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await query('SELECT id, username, created_at FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware
export function verifyToken(req, res, next) {
  const token = readAuthToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

export default router;

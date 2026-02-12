import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getDbStatus } from './database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-prod';

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
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ user, token });
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

  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, created_at: user.created_at }, token });
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

    // 3. Generate new token with updated info
    const token = jwt.sign({ id: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      message: 'Credentials updated successfully',
      user: updatedUser,
      token 
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username already taken' });
    }
    console.error('Update credentials error:', err);
    res.status(500).json({ message: 'Server error' });
  }
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
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

export default router;

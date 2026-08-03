import jwt from 'jsonwebtoken';
import { readAuthToken } from '../auth.js';

export function optionalAuth(req, _res, next) {
  const token = readAuthToken(req);
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
}

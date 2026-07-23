export function adminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];

  if (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
    next();
    return;
  }

  res.status(401).json({ message: 'Unauthorized: Admin key required' });
}

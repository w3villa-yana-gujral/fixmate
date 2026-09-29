const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET || 'development-secret')
    next()
  } catch { res.status(401).json({ message: 'Invalid or expired session.' }) }
}

module.exports = { requireAuth }
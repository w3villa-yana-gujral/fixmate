const express = require('express')
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const requester = await User.findById(req.auth.sub).select('role')
    if (requester?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' })
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50)
    const search = String(req.query.search || '').trim()
    const role = ['customer', 'admin'].includes(req.query.role) ? req.query.role : ''
    const planStatus = ['active', 'inactive', 'pending'].includes(req.query.planStatus) ? req.query.planStatus : ''
    const query = {}
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]
    if (role) query.role = role
    if (planStatus) query.planStatus = planStatus
    const [users, total] = await Promise.all([
      User.find(query).select('name email role accessLevel planName planStatus planExpiresAt planPurchasedAt createdAt avatar').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query)
    ])
    res.json({ users, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } })
  } catch (error) { next(error) }
})

module.exports = router

const express = require('express')
const Stripe = require('stripe')
const User = require('../models/User')
const Booking = require('../models/Booking')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

async function requireAdmin(req, res, next) {
  try {
    const requester = await User.findById(req.auth.sub).select('role')
    if (requester?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' })
    next()
  } catch (error) { next(error) }
}

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

router.get('/bookings', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const bookings = await Booking.find().populate('user', 'name email').sort({ scheduledDate: -1 }).limit(200)
    res.json({ bookings })
  } catch (error) { next(error) }
})

router.patch('/bookings/:id/cancel', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body || {}
    const details = typeof req.body?.details === 'string' ? req.body.details.trim() : ''
    const cancellationReasons = ['schedule_conflict', 'no_longer_needed', 'booked_by_mistake', 'found_another_provider', 'price_concern', 'other']
    if (!cancellationReasons.includes(reason)) return res.status(400).json({ message: 'Choose a reason for cancelling this booking.' })
    if (reason === 'other' && !details) return res.status(400).json({ message: 'Please provide the cancellation reason.' })
    if (details.length > 500) return res.status(400).json({ message: 'Cancellation details must be 500 characters or fewer.' })

    const booking = await Booking.findOne({ _id: req.params.id, status: { $in: ['pending_payment', 'requested', 'confirmed', 'in_progress'] } })
    if (!booking) return res.status(404).json({ message: 'Booking cannot be cancelled.' })

    if (booking.status === 'pending_payment' && booking.stripeSessionId && stripe) {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      if (session.payment_status === 'paid') {
        booking.paymentStatus = 'paid'
        booking.amountPaid = booking.amountDue
        booking.paidAt = new Date()
      } else if (session.status === 'open') {
        await stripe.checkout.sessions.expire(session.id)
      } else if (session.status === 'complete') {
        return res.status(409).json({ message: 'Payment is still processing. Please retry cancellation in a moment.' })
      }
    }

    booking.status = 'cancelled'
    booking.cancellationReason = reason
    booking.cancellationDetails = details || undefined
    await booking.save()
    await booking.populate('user', 'name email')
    res.json({ message: booking.paymentStatus === 'paid' ? 'Booking cancelled. No refund was issued.' : 'Booking cancelled.', booking })
  } catch (error) { next(error) }
})

module.exports = router

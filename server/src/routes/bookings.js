const express = require('express')
const Stripe = require('stripe')
const Booking = require('../models/Booking')
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')
const { SERVICE_PRICES, getActivePlan, getServicePrice } = require('../services/servicePricing')

const router = express.Router()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const clientUrl = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://fixmate-lilac.vercel.app' : 'http://localhost:5173')
const services = [
  { id: 'cleaning', title: 'Cleaning', icon: '⌂', detail: 'Home refresh' },
  { id: 'plumbing', title: 'Plumbing', icon: '⌁', detail: 'Fix a leak' },
  { id: 'electrical', title: 'Electrical', icon: '✦', detail: 'Power & lights' },
  { id: 'appliances', title: 'Appliances', icon: '◒', detail: 'Keep it running' },
  { id: 'carpentry', title: 'Carpentry', icon: '⌘', detail: 'Build & repair' },
  { id: 'painting', title: 'Painting', icon: '◈', detail: 'Refresh a room' },
  { id: 'pest-control', title: 'Pest control', icon: '◎', detail: 'Protect your home' },
  { id: 'moving', title: 'Moving', icon: '▣', detail: 'Make a move easier' }
]

router.get('/services', (_req, res) => res.json({ services: services.map((service) => ({ ...service, startingPrice: SERVICE_PRICES[service.title] })) }))

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.auth.sub }).sort({ scheduledDate: -1 })
    res.json({ bookings })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { service, requirement, scheduledDate, address } = req.body
    if (!service || !requirement || !scheduledDate || !address) return res.status(400).json({ message: 'Service, requirement, date, and address are required.' })
    if (!services.some((item) => item.title === service)) return res.status(400).json({ message: 'Choose a valid service.' })
    if (new Date(scheduledDate) <= new Date()) return res.status(400).json({ message: 'Choose a future date and time.' })
    if (!stripe) return res.status(503).json({ message: 'Service payments are unavailable. Add STRIPE_SECRET_KEY to server/.env.' })
    const user = await User.findById(req.auth.sub)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    const plan = getActivePlan(user)
    const pricing = getServicePrice(service, plan)
    const serviceDetails = services.find((item) => item.title === service)
    const booking = await Booking.create({
      user: user._id,
      service,
      requirement,
      scheduledDate,
      address,
      planAtBooking: plan,
      priority: plan === 'gold' ? 'preferred' : plan === 'silver' ? 'priority' : 'standard',
      status: 'pending_payment',
      paymentStatus: 'pending',
      basePrice: pricing.basePrice,
      discountPercent: pricing.discountPercent,
      amountDue: pricing.finalPrice,
      serviceIcon: serviceDetails.icon
    })
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency: 'inr',
            product_data: { name: `FixMate ${service} service`, description: `${plan[0].toUpperCase()}${plan.slice(1)} plan price${pricing.discountPercent ? `, ${pricing.discountPercent}% discount` : ''}` },
            unit_amount: pricing.finalPrice * 100
          },
          quantity: 1
        }],
        metadata: { type: 'booking', userId: String(user._id), bookingId: String(booking._id) },
        success_url: `${clientUrl}?payment=success&checkout_type=booking&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}?payment=cancelled&checkout_type=booking&booking_id=${booking._id}`
      })
      booking.stripeSessionId = session.id
      await booking.save()
      res.status(201).json({ url: session.url, booking, pricing })
    } catch (error) {
      await Booking.findByIdAndDelete(booking._id)
      throw error
    }
  } catch (error) { next(error) }
})

router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { reason } = req.body || {}
    const details = typeof req.body?.details === 'string' ? req.body.details : ''
    const cancellationReasons = ['schedule_conflict', 'no_longer_needed', 'booked_by_mistake', 'found_another_provider', 'price_concern', 'other']
    if (!cancellationReasons.includes(reason)) return res.status(400).json({ message: 'Choose a reason for cancelling this booking.' })
    if (reason === 'other' && !details.trim()) return res.status(400).json({ message: 'Please tell us why you are cancelling.' })
    if (details.length > 500) return res.status(400).json({ message: 'Cancellation details must be 500 characters or fewer.' })
    const existing = await Booking.findOne({ _id: req.params.id, user: req.auth.sub, status: { $in: ['pending_payment', 'requested', 'confirmed'] } })
    if (!existing) return res.status(404).json({ message: 'Booking cannot be cancelled.' })
    if (existing.status === 'pending_payment' && existing.stripeSessionId && stripe) {
      const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId)
      if (session.payment_status === 'paid') {
        existing.paymentStatus = 'paid'
        existing.amountPaid = existing.amountDue
        existing.paidAt = new Date()
      } else if (session.status === 'open') {
        await stripe.checkout.sessions.expire(session.id)
      } else if (session.status === 'complete') {
        return res.status(409).json({ message: 'Payment is still processing. Please retry cancellation in a moment.' })
      }
    }
    existing.status = 'cancelled'
    existing.cancellationReason = reason
    existing.cancellationDetails = reason === 'other' ? details.trim() : undefined
    await existing.save()
    res.json({ message: existing.paymentStatus === 'paid' ? 'Booking cancelled. No refund was issued.' : 'Booking cancelled.', booking: existing })
  } catch (error) { next(error) }
})

module.exports = router

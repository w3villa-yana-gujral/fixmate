const express = require('express')
const Stripe = require('stripe')
const User = require('../models/User')
const Booking = require('../models/Booking')
const { requireAuth } = require('../middleware/auth')
const { PLAN_DEFINITIONS, activationFields } = require('../services/plans')

const router = express.Router()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

router.get('/plans', (_req, res) => res.json({ plans: PLAN_DEFINITIONS }))

router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const plan = PLAN_DEFINITIONS[req.body.plan]
    if (!plan) return res.status(400).json({ message: 'Choose a valid pricing plan.' })
    const user = await User.findById(req.auth.sub)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    if (req.body.plan === 'free') {
      const updated = await User.findByIdAndUpdate(user._id, activationFields('free'), { new: true }).select('-passwordHash -verificationToken -verificationExpires')
      return res.json({ status: 'activated', user: updated })
    }
    if (!stripe) return res.status(503).json({ message: 'Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env.' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [{ price_data: { currency: 'inr', product_data: { name: plan.name, description: `${plan.description} for ${plan.durationHours} hours` }, unit_amount: plan.amount }, quantity: 1 }],
      metadata: { userId: String(user._id), plan: req.body.plan },
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?payment=cancelled`
    })
    user.planStatus = 'pending'; await user.save()
    res.json({ url: session.url })
  } catch (error) { console.error('Stripe checkout failed:', error.message); res.status(error.statusCode || 500).json({ message: error.message || 'Unable to start checkout.' }) }
})

async function activatePaidSession(session, userId) {
  const plan = PLAN_DEFINITIONS[session.metadata?.plan]
  if (!plan || !userId) return null
  return User.findByIdAndUpdate(userId, { ...activationFields(session.metadata.plan, session.payment_intent || session.id), stripeCustomerId: session.customer || undefined }, { new: true }).select('-passwordHash -verificationToken -verificationExpires')
}

async function confirmPaidBookingSession(session, userId) {
  if (session.metadata?.type !== 'booking' || session.metadata.userId !== String(userId)) return null
  const booking = await Booking.findOne({ _id: session.metadata.bookingId, user: userId, stripeSessionId: session.id })
  if (!booking || booking.status === 'cancelled') return null
  if (session.payment_status !== 'paid' || session.currency !== 'inr' || session.amount_total !== booking.amountDue * 100) return null
  if (booking.paymentStatus !== 'paid') {
    booking.paymentStatus = 'paid'
    booking.paidAt = new Date()
    booking.amountPaid = booking.amountDue
    booking.status = 'confirmed'
    await booking.save()
  }
  return booking
}

router.get('/session-status', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ message: 'Stripe is not configured.' })
    if (!req.query.session_id) return res.status(400).json({ message: 'Missing checkout session.' })
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id)
    if (session.metadata?.userId !== String(req.auth.sub)) return res.status(403).json({ message: 'This checkout session does not belong to this account.' })
    if (session.metadata?.type === 'booking') {
      const booking = await confirmPaidBookingSession(session, req.auth.sub)
      if (session.payment_status !== 'paid') return res.json({ status: 'pending' })
      if (!booking) return res.status(400).json({ message: 'This booking payment could not be verified.' })
      return res.json({ status: 'paid', booking })
    }
    if (session.payment_status !== 'paid' && session.status !== 'complete') return res.json({ status: 'pending' })
    const user = await activatePaidSession(session, req.auth.sub)
    res.json({ status: 'paid', user })
  } catch (error) { next(error) }
})

router.post('/webhook', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook is not configured.')
  let event
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET) } catch (error) { return res.status(400).send(`Webhook Error: ${error.message}`) }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = event.data.object
    if (session.metadata?.type === 'booking') await confirmPaidBookingSession(session, session.metadata?.userId)
    else await activatePaidSession(session, session.metadata?.userId)
  }
  res.json({ received: true })
})

module.exports = router

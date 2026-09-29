const express = require('express')
const Booking = require('../models/Booking')
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
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

router.get('/services', (_req, res) => res.json({ services }))

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
    const user = await User.findById(req.auth.sub)
    if (!user) return res.status(404).json({ message: 'User not found.' })
    const plan = user.accessLevel || 'free'
    const booking = await Booking.create({ user: user._id, service, requirement, scheduledDate, address, planAtBooking: plan, priority: plan === 'gold' ? 'preferred' : plan === 'silver' ? 'priority' : 'standard', status: 'confirmed', serviceIcon: services.find((item) => item.title === service).icon })
    res.status(201).json({ message: 'Your service is confirmed. We will send the details shortly.', booking })
  } catch (error) { next(error) }
})

router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findOneAndUpdate({ _id: req.params.id, user: req.auth.sub, status: { $in: ['requested', 'confirmed'] } }, { status: 'cancelled' }, { new: true })
    if (!booking) return res.status(404).json({ message: 'Booking cannot be cancelled.' })
    res.json({ message: 'Booking cancelled.', booking })
  } catch (error) { next(error) }
})

module.exports = router

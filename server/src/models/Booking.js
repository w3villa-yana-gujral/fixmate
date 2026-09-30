const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  service: { type: String, enum: ['Cleaning', 'Plumbing', 'Electrical', 'Appliances', 'Carpentry', 'Painting', 'Pest control', 'Moving'], required: true },
  serviceIcon: String,
  requirement: { type: String, required: true, trim: true, maxlength: 1000 },
  scheduledDate: { type: Date, required: true },
  address: { type: String, required: true, trim: true },
  planAtBooking: { type: String, enum: ['free', 'silver', 'gold'], default: 'free' },
  priority: { type: String, enum: ['standard', 'priority', 'preferred'], default: 'standard' },
  basePrice: Number,
  discountPercent: { type: Number, default: 0 },
  amountDue: Number,
  amountPaid: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  stripeSessionId: { type: String, index: true },
  paidAt: Date,
  cancellationReason: { type: String, enum: ['schedule_conflict', 'no_longer_needed', 'booked_by_mistake', 'found_another_provider', 'price_concern', 'other'] },
  cancellationDetails: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending_payment', 'requested', 'confirmed', 'in_progress', 'completed', 'cancelled'], default: 'pending_payment' }
}, { timestamps: true })

module.exports = mongoose.model('Booking', bookingSchema)

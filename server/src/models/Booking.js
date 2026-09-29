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
  status: { type: String, enum: ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled'], default: 'confirmed' }
}, { timestamps: true })

module.exports = mongoose.model('Booking', bookingSchema)

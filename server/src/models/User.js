const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationExpires: { type: Date },
  avatar: {
    url: { type: String },
    publicId: { type: String }
  },
  address: {
    formatted: String,
    line1: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    latitude: Number,
    longitude: Number
  },
  accessLevel: { type: String, enum: ['free', 'silver', 'gold'], default: 'free' },
  planName: { type: String, default: 'Free' },
  planStatus: { type: String, enum: ['inactive', 'active', 'pending'], default: 'inactive' },
  planExpiresAt: { type: Date },
  stripeCustomerId: { type: String },
  stripePaymentId: { type: String },
  planPurchasedAt: { type: Date },
  providers: [{ name: { type: String, enum: ['google', 'facebook'] }, providerId: String }]
}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)

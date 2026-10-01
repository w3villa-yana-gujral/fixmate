const express = require('express')
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const User = require('../models/User')
const { requireAuth } = require('../middleware/auth')
const { expirePlans } = require('../services/plans')
const { generateProfilePdf } = require('../services/profilePdf')
const UserModel = require('../models/User')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, done) => done(null, file.mimetype.startsWith('image/')) })

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })

router.get('/geocode/search', requireAuth, async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim()
    if (query.length < 3) return res.json({ results: [] })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json', 'User-Agent': 'FixMate/1.0 address search' } })
    if (!response.ok) return res.status(502).json({ message: 'Address search is temporarily unavailable.', results: [] })
    res.json({ results: await response.json() })
  } catch (error) { next(error) }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    await expirePlans(UserModel)
    const user = await User.findById(req.auth.sub).select('-passwordHash -verificationToken -verificationExpires')
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json({ user })
  } catch (error) { next(error) }
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['formatted', 'line1', 'city', 'state', 'postalCode', 'country', 'latitude', 'longitude']
    const address = Object.fromEntries(Object.entries(req.body.address || {}).filter(([key]) => allowed.includes(key)))
    const user = await User.findByIdAndUpdate(req.auth.sub, { $set: { address } }, { new: true, runValidators: true }).select('-passwordHash -verificationToken -verificationExpires')
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json({ message: 'Address updated.', user })
  } catch (error) { next(error) }
})

router.get('/me/export', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('name email role isVerified address avatar createdAt updatedAt')
    if (!user) return res.status(404).json({ message: 'User not found.' })
    const profile = {
      document: 'FixMate profile export',
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.isVerified,
        profilePicture: user.avatar?.url || null,
        address: user.address || null,
        accountCreated: user.createdAt,
        lastUpdated: user.updatedAt
      }
    }
    const filename = `fixmate-profile-${user._id}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(JSON.stringify(profile, null, 2))
  } catch (error) { next(error) }
})

router.get('/me/export.pdf', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('name email role isVerified address avatar createdAt updatedAt')
    if (!user) return res.status(404).json({ message: 'User not found.' })

    const pdf = await generateProfilePdf(user)
    const filename = `fixmate-profile-${user._id}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (error) { next(error) }
})

router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please upload an image.' })
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ message: 'Cloudinary is not fully configured. Add cloud name, API key, and API secret to server/.env, then restart the API.' })
    const user = await User.findById(req.auth.sub)
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'fixmate/avatars', resource_type: 'image', public_id: `user-${user._id}`, overwrite: true }, (error, value) => error ? reject(error) : resolve(value))
      stream.end(req.file.buffer)
    })
    user.avatar = { url: result.secure_url, publicId: result.public_id }
    await user.save()
    res.json({ message: 'Profile picture updated.', avatar: user.avatar })
  } catch (error) {
    console.error('Avatar upload failed:', error.message)
    const message = error.http_code === 403
      ? 'Cloudinary rejected this API key: it does not have permission to create uploads. Enable the create/upload permission for this key or use a key with upload access, then restart the API.'
      : `Cloudinary upload failed: ${error.message}`
    res.status(502).json({ message })
  }
})

module.exports = router
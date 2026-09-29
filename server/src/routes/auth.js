const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const User = require('../models/User')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email')

const router = express.Router()
const tokenFor = (user, rememberMe = false) => jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET || 'development-secret', { expiresIn: rememberMe ? '30d' : '1d' })

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback` }, async (_accessToken, _refreshToken, profile, done) => {
    try { done(null, { profile, provider: 'google' }) } catch (error) { done(error) }
  }))
}
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({ clientID: process.env.FACEBOOK_APP_ID, clientSecret: process.env.FACEBOOK_APP_SECRET, callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/facebook/callback`, graphAPIVersion: process.env.FACEBOOK_GRAPH_API_VERSION || 'v23.0', profileFields: ['id', 'displayName', 'emails'] }, async (_accessToken, _refreshToken, profile, done) => {
    try { done(null, { profile, provider: 'facebook' }) } catch (error) { done(error) }
  }))
}

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' })
    const normalizedEmail = email.toLowerCase().trim()
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) return res.status(409).json({ message: 'An account with this email already exists. Try logging in.' })
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const user = await User.create({ name, email: normalizedEmail, role: 'customer', passwordHash: await bcrypt.hash(password, 12), verificationToken, verificationExpires: Date.now() + 86400000 })
    await sendVerificationEmail(user, verificationToken)
    res.status(201).json({ message: 'Account created. Check your email to verify your account.', userId: user._id })
  } catch (error) { next(error) }
})

router.get('/verify-email', async (req, res, next) => {
  try {
    const user = await User.findOne({ verificationToken: req.query.token, verificationExpires: { $gt: Date.now() } })
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    if (!user) return res.redirect(`${clientUrl}/?verification=invalid`)
    user.isVerified = true; user.verificationToken = undefined; user.verificationExpires = undefined
    await user.save()
    res.redirect(`${clientUrl}/?verification=success`)
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body
    const user = await User.findOne({ email: email?.toLowerCase().trim() })
    if (!user || !user.passwordHash || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' })
    if (!user.isVerified) return res.status(403).json({ message: 'Please verify your email before logging in.' })
    res.json({ token: tokenFor(user, rememberMe), user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = req.body.email?.toLowerCase().trim()
    const user = await User.findOne({ email })
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      user.resetPasswordToken = token; user.resetPasswordExpires = Date.now() + 15 * 60 * 1000
      await user.save(); await sendPasswordResetEmail(user, token)
    }
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' })
  } catch (error) { next(error) }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (!token || !password || password.length < 8) return res.status(400).json({ message: 'A valid token and password of at least 8 characters are required.' })
    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } })
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired.' })
    user.passwordHash = await bcrypt.hash(password, 12); user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined
    await user.save()
    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (error) { next(error) }
})

async function socialLogin({ name, email, provider, providerId, role = 'customer' }) {
  let user = await User.findOne({ email: email.toLowerCase().trim() })
  const socialRole = role === 'admin' ? 'admin' : 'customer'
  if (!user) user = await User.create({ name, email, role: socialRole, isVerified: true, providers: [{ name: provider, providerId }] })
  else if (!user.providers.some((item) => item.name === provider && item.providerId === providerId)) { user.providers.push({ name, providerId }); user.role = ['customer', 'admin'].includes(user.role) ? user.role : 'customer'; user.isVerified = true; await user.save() }
  return user
}

router.post('/social/:provider', async (req, res, next) => {
  try {
    const { provider } = req.params
    if (!['google', 'facebook'].includes(provider)) return res.status(400).json({ message: 'Unsupported provider.' })
    const { name, email, providerId } = req.body
    if (!name || !email || !providerId) return res.status(400).json({ message: 'Social profile data is required.' })
    const user = await socialLogin({ name, email, provider, providerId, role: 'customer' })
    res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

function socialRedirect(provider) {
  return (req, res, next) => {
    const isConfigured = provider === 'google' ? Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) : Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
    if (!isConfigured) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?socialError=${provider}_not_configured`)
    return passport.authenticate(provider, { session: false, scope: provider === 'google' ? ['profile', 'email'] : ['public_profile'] })(req, res, next)
  }
}
router.get('/google', socialRedirect('google'))
router.get('/facebook', socialRedirect('facebook'))
router.get('/google/callback', (req, res, next) => {
  if (!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?socialError=google_not_configured`)
  return passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/?socialError=google` })(req, res, next)
}, async (req, res, next) => completeSocial(req, res, next))
router.get('/facebook/callback', (req, res, next) => {
  if (!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?socialError=facebook_not_configured`)
  return passport.authenticate('facebook', { session: false, failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/?socialError=facebook` })(req, res, next)
}, async (req, res, next) => completeSocial(req, res, next))

async function completeSocial(req, res, next) {
  try {
    const { profile, provider } = req.user
    const email = profile.emails?.[0]?.value || `${provider}-${profile.id}@social.fixmate.local`
    const user = await socialLogin({ name: profile.displayName || profile.username || `${provider} user`, email, provider, providerId: profile.id, role: 'customer' })
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?token=${tokenFor(user)}`)
  } catch (error) { next(error) }
}

module.exports = router

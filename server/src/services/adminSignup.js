const crypto = require('crypto')

const pendingCodes = new Map()

function isAllowedAdminEmail(email) {
  const allowed = (process.env.ADMIN_SIGNUP_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.toLowerCase())
}

function createAdminCode(email) {
  const code = String(crypto.randomInt(100000, 1000000))
  pendingCodes.set(email.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 })
  return code
}

function verifyAdminCode(email, code) {
  const pending = pendingCodes.get(email.toLowerCase())
  if (!pending || pending.expiresAt < Date.now() || pending.code !== String(code || '')) return false
  pendingCodes.delete(email.toLowerCase())
  return true
}

module.exports = { isAllowedAdminEmail, createAdminCode, verifyAdminCode }

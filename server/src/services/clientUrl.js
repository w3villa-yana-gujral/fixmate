const PRODUCTION_CLIENT_URL = 'https://fixmate-client-git-main-yana-404c.vercel.app'
const API_HOSTNAME = 'fixmate-lilac.vercel.app'

function getClientUrl() {
  const configuredUrl = process.env.CLIENT_URL?.trim()
  if (process.env.NODE_ENV !== 'production') return (configuredUrl || 'http://localhost:5173').replace(/\/+$/, '')

  try {
    const parsedUrl = new URL(configuredUrl)
    const hostname = parsedUrl.hostname.toLowerCase()
    const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.startsWith('127.') || hostname === '::1' || hostname === '[::1]'
    if (parsedUrl.protocol === 'https:' && !isLocalhost && hostname !== API_HOSTNAME) return parsedUrl.origin
  } catch {}

  return PRODUCTION_CLIENT_URL
}

module.exports = { getClientUrl }
const PRODUCTION_CLIENT_URL = 'https://fixmate-lilac.vercel.app'

function getClientUrl() {
  const configuredUrl = process.env.CLIENT_URL?.trim()
  if (process.env.NODE_ENV !== 'production') return (configuredUrl || 'http://localhost:5173').replace(/\/+$/, '')

  try {
    const parsedUrl = new URL(configuredUrl)
    const hostname = parsedUrl.hostname.toLowerCase()
    const isLocalhost = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.startsWith('127.') || hostname === '::1' || hostname === '[::1]'
    if (parsedUrl.protocol === 'https:' && !isLocalhost) return parsedUrl.origin
  } catch {}

  return PRODUCTION_CLIENT_URL
}

module.exports = { getClientUrl }
const PRODUCTION_CLIENT_URL = 'https://fixmate-client-gamma.vercel.app'

function getClientUrl() {
  const configuredUrl = process.env.CLIENT_URL?.trim()
  if (process.env.NODE_ENV !== 'production') return (configuredUrl || 'http://localhost:5173').replace(/\/+$/, '')
  return PRODUCTION_CLIENT_URL
}

module.exports = { getClientUrl }
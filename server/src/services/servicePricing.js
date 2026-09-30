const SERVICE_PRICES = {
  Cleaning: 2999,
  Plumbing: 1499,
  Electrical: 1799,
  Appliances: 1999,
  Carpentry: 2499,
  Painting: 3499,
  'Pest control': 1999,
  Moving: 5999
}

const PLAN_DISCOUNTS = { free: 0, silver: 5, gold: 10 }

function getActivePlan(user) {
  const active = user.planStatus === 'active' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date()
  return active && PLAN_DISCOUNTS[user.accessLevel] !== undefined ? user.accessLevel : 'free'
}

function getServicePrice(service, plan) {
  const basePrice = SERVICE_PRICES[service]
  if (basePrice === undefined) return null
  const discountPercent = PLAN_DISCOUNTS[plan] || 0
  const finalPrice = Math.round(basePrice * (100 - discountPercent) / 100)
  return { basePrice, discountPercent, finalPrice }
}

module.exports = { SERVICE_PRICES, PLAN_DISCOUNTS, getActivePlan, getServicePrice }

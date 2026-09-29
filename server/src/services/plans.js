const PLAN_DEFINITIONS = {
  free: { name: 'Free', amount: 0, durationHours: 1, description: 'A simple start for every home', accessLevel: 'free' },
  silver: { name: 'Silver', amount: 49900, durationHours: 6, description: 'Priority booking and member pricing', accessLevel: 'silver' },
  gold: { name: 'Gold', amount: 99900, durationHours: 12, description: 'Preferred professionals and premium support', accessLevel: 'gold' }
}

function getPlan(planId) {
  return PLAN_DEFINITIONS[planId]
}

function activationFields(planId, paymentId) {
  const plan = getPlan(planId)
  return {
    accessLevel: plan.accessLevel,
    planName: plan.name,
    planStatus: 'active',
    planExpiresAt: new Date(Date.now() + plan.durationHours * 60 * 60 * 1000),
    planPurchasedAt: new Date(),
    ...(paymentId ? { stripePaymentId: paymentId } : {})
  }
}

async function expirePlans(User) {
  return User.updateMany({ $or: [{ planStatus: 'active', planExpiresAt: { $lte: new Date() } }, { accessLevel: { $in: ['plus', 'pro'] } }] }, { $set: { accessLevel: 'free', planName: 'Free', planStatus: 'inactive' }, $unset: { planExpiresAt: 1 } })
}

module.exports = { PLAN_DEFINITIONS, getPlan, activationFields, expirePlans }

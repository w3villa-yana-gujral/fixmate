const cron = require('node-cron')
const User = require('../models/User')
const { expirePlans } = require('./plans')

function startPlanExpiryJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const result = await expirePlans(User)
      if (result.modifiedCount) console.log(`Expired ${result.modifiedCount} FixMate plan(s).`)
    } catch (error) { console.error('Plan expiry job failed:', error.message) }
  })
  console.log('Plan expiry job scheduled: every minute')
}

module.exports = { startPlanExpiryJob }

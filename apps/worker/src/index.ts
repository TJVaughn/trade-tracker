import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '@trade-tracker/db'
import { pollEntity } from './poller'

async function runPoll() {
  const entities = await prisma.entity.findMany({ where: { tracked: true } })
  console.log(`Polling ${entities.length} entities...`)
  for (const entity of entities) {
    try {
      await pollEntity(entity)
    } catch (err) {
      console.error(`Failed to poll ${entity.name}:`, err)
    }
  }
}

// Poll every 15 minutes
cron.schedule('*/15 * * * *', runPoll)
// Also run immediately on startup
runPoll().catch(console.error)
console.log('Worker started. Polling every 15 minutes.')

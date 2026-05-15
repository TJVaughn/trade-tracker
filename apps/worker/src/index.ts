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

function pollIntervalMs(): number {
  const rawValue = process.env.EDGAR_POLL_INTERVAL_MS ?? '900000'
  const interval = Number(rawValue)

  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error('EDGAR_POLL_INTERVAL_MS must be a positive integer')
  }

  return interval
}

const intervalMs = pollIntervalMs()

// Preserve the 15-minute cron-friendly default, but honor custom millisecond intervals.
if (intervalMs === 900_000) {
  cron.schedule('*/15 * * * *', () => {
    runPoll().catch(console.error)
  })
} else {
  setInterval(() => {
    runPoll().catch(console.error)
  }, intervalMs)
}

// Also run immediately on startup
runPoll().catch(console.error)
console.log(`Worker started. Polling every ${Math.round(intervalMs / 1000)} seconds.`)

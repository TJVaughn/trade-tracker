import { prisma } from './index'

const entities = [
  // Politicians
  { cik: '0001451289', name: 'Nancy Pelosi', type: 'PERSON' as const },
  // Paul Pelosi shares CIK 0001451289 with Nancy — omitted as duplicate

  // Hedge Funds / Asset Managers
  { cik: '0001361786', name: 'Michael Burry / Scion Asset Management', type: 'COMPANY' as const },
  { cik: '0001418533', name: 'Cathie Wood / ARK Invest', type: 'COMPANY' as const },
  { cik: '0001656456', name: 'David Tepper / Appaloosa Management', type: 'COMPANY' as const },
  { cik: '0001029160', name: 'George Soros / Soros Fund Management', type: 'COMPANY' as const },
  { cik: '0001536411', name: 'Stanley Druckenmiller / Duquesne Family Office', type: 'COMPANY' as const },

  // Institutional
  { cik: '0001067983', name: 'Berkshire Hathaway', type: 'COMPANY' as const },
  { cik: '0000315090', name: 'Warren Buffett', type: 'PERSON' as const },

  // Activist Investors
  { cik: '0000921669', name: 'Carl Icahn / Icahn Capital', type: 'COMPANY' as const },
  { cik: '0001336528', name: 'Bill Ackman / Pershing Square', type: 'COMPANY' as const },

  // Corporate Insiders (CIK is the company's — EDGAR returns insider Form 4s when queried by company CIK)
  { cik: '0001045810', name: 'Jensen Huang / NVIDIA', type: 'COMPANY' as const },
  { cik: '0000320193', name: 'Tim Cook / Apple', type: 'COMPANY' as const },
  // Jamie Dimon and JPMorgan Chase share CIK 0000019617 — merged into one entry
  { cik: '0000019617', name: 'JPMorgan Chase / Jamie Dimon', type: 'COMPANY' as const },
  { cik: '0001494730', name: 'Elon Musk', type: 'PERSON' as const },
  { cik: '0001326801', name: 'Mark Zuckerberg / Meta', type: 'COMPANY' as const },
  { cik: '0001652044', name: 'Sundar Pichai / Alphabet', type: 'COMPANY' as const },
  { cik: '0000886982', name: 'Goldman Sachs / Lloyd Blankfein', type: 'COMPANY' as const },
  { cik: '0000034088', name: 'Darren Woods / ExxonMobil', type: 'COMPANY' as const },
]

async function main() {
  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { cik: entity.cik },
      update: { name: entity.name, type: entity.type },
      create: { ...entity, tracked: true },
    })
  }
  console.log(`Seeded ${entities.length} entities`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { prisma } from './index'

const entities = [
  { cik: '0001649338', name: 'Nancy Pelosi', type: 'PERSON' as const },
  { cik: '0000315090', name: 'Warren Buffett (Berkshire Hathaway)', type: 'PERSON' as const },
  { cik: '0001336528', name: 'Palantir Technologies', type: 'COMPANY' as const },
  { cik: '0001036176', name: 'Elon Musk', type: 'PERSON' as const },
  { cik: '0001718108', name: 'Michael Burry (Scion Asset Management)', type: 'PERSON' as const },
]

async function main() {
  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { cik: entity.cik },
      update: {},
      create: { ...entity, tracked: true },
    })
  }
  console.log('Seeded entities')
}

main().catch(console.error).finally(() => prisma.$disconnect())

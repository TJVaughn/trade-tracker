import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entityId') || undefined
  const filingId = searchParams.get('filingId') || undefined
  const code = searchParams.get('code') || undefined
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const minValue = searchParams.get('minValue') ? parseFloat(searchParams.get('minValue')!) : undefined

  const where = {
    ...(filingId ? { filingId } : {}),
    ...(entityId ? { filing: { entityId } } : {}),
    ...(code ? { transactionCode: code } : {}),
    ...(startDate || endDate
      ? {
          transactionDate: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        }
      : {}),
    ...(minValue != null
      ? { totalValue: { gte: minValue } }
      : {}),
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        filing: {
          include: { entity: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page })
}

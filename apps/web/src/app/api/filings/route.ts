import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entityId') || undefined
  const formType = searchParams.get('formType') || undefined
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '25')

  const where = {
    ...(entityId ? { entityId } : {}),
    ...(formType ? { formType: formType as 'FORM_4' | 'FORM_13F' | 'SCHEDULE_13DG' } : {}),
    ...(startDate || endDate
      ? {
          filedAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        }
      : {}),
  }

  const [filings, total] = await Promise.all([
    prisma.filing.findMany({
      where,
      include: {
        entity: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { filedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.filing.count({ where }),
  ])

  return NextResponse.json({ filings, total, page })
}

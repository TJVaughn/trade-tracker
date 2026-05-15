import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import { badRequest, parseDateParam, parsePositiveIntParam } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entityId') || undefined
  const filingId = searchParams.get('filingId') || undefined
  const code = searchParams.get('code') || undefined
  let startDate: Date | undefined
  let endDate: Date | undefined
  let page: number
  let limit: number
  let minValue: number | undefined
  try {
    startDate = parseDateParam(searchParams, 'startDate')
    endDate = parseDateParam(searchParams, 'endDate')
    page = parsePositiveIntParam(searchParams, 'page', 1)
    limit = parsePositiveIntParam(searchParams, 'limit', 50)
    const rawMinValue = searchParams.get('minValue')
    minValue = rawMinValue ? Number(rawMinValue) : undefined
    if (
      minValue !== undefined &&
      (!Number.isFinite(minValue) || minValue < 0)
    ) {
      throw new Error('minValue must be a non-negative number')
    }
  } catch (err) {
    return badRequest(
      err instanceof Error ? err.message : 'Invalid query parameters',
    )
  }

  const where = {
    ...(filingId ? { filingId } : {}),
    ...(entityId ? { filing: { entityId } } : {}),
    ...(code ? { transactionCode: code } : {}),
    ...(startDate || endDate
      ? {
          transactionDate: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
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

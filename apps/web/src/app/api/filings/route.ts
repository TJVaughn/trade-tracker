import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import {
  badRequest,
  isFormType,
  parseDateParam,
  parsePositiveIntParam,
} from '@/lib/api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entityId') || undefined
  const formType = searchParams.get('formType') || undefined
  if (formType && !isFormType(formType)) {
    return badRequest('formType must be FORM_4, FORM_13F, or SCHEDULE_13DG')
  }

  let startDate: Date | undefined
  let endDate: Date | undefined
  let page: number
  let limit: number
  try {
    startDate = parseDateParam(searchParams, 'startDate')
    endDate = parseDateParam(searchParams, 'endDate')
    page = parsePositiveIntParam(searchParams, 'page', 1)
    limit = parsePositiveIntParam(searchParams, 'limit', 25)
  } catch (err) {
    return badRequest(
      err instanceof Error ? err.message : 'Invalid query parameters',
    )
  }

  const where = {
    ...(entityId ? { entityId } : {}),
    ...(formType ? { formType } : {}),
    ...(startDate || endDate
      ? {
          filedAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
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

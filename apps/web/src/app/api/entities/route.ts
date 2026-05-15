import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tracked = searchParams.get('tracked')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const where = {
    ...(tracked !== null ? { tracked: tracked === 'true' } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [entities, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      include: { _count: { select: { filings: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.entity.count({ where }),
  ])

  return NextResponse.json({ entities, total, page })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cik, name, type, description } = body

  if (!cik || !name || !type) {
    return NextResponse.json({ error: 'cik, name, and type are required' }, { status: 400 })
  }
  if (!/^\d+$/.test(cik)) {
    return NextResponse.json({ error: 'CIK must be numeric' }, { status: 400 })
  }

  try {
    const entity = await prisma.entity.create({
      data: { cik, name, type, description, tracked: true },
    })
    return NextResponse.json(entity, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Entity with this CIK already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

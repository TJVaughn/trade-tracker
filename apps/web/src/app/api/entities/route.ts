import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import { badRequest, isEntityType, parsePositiveIntParam } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tracked = searchParams.get('tracked')
  if (tracked !== null && tracked !== 'true' && tracked !== 'false') {
    return badRequest('tracked must be true or false')
  }
  const search = searchParams.get('search')
  let page: number
  let limit: number
  try {
    page = parsePositiveIntParam(searchParams, 'page', 1)
    limit = parsePositiveIntParam(searchParams, 'limit', 50)
  } catch (err) {
    return badRequest(
      err instanceof Error ? err.message : 'Invalid pagination parameters',
    )
  }

  const where = {
    ...(tracked !== null ? { tracked: tracked === 'true' } : {}),
    ...(search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {}),
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
    return NextResponse.json(
      { error: 'cik, name, and type are required' },
      { status: 400 },
    )
  }
  if (typeof cik !== 'string' || !/^\d+$/.test(cik)) {
    return badRequest('CIK must be numeric')
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return badRequest('name must be a non-empty string')
  }
  if (!isEntityType(type)) {
    return badRequest('type must be PERSON or COMPANY')
  }
  if (description !== undefined && typeof description !== 'string') {
    return badRequest('description must be a string')
  }

  try {
    const entity = await prisma.entity.create({
      data: {
        cik,
        name: name.trim(),
        type,
        description: description?.trim() || null,
        tracked: true,
      },
    })
    return NextResponse.json(entity, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Entity with this CIK already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

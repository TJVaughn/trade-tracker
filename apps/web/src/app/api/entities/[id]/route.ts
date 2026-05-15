import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import {
  badRequest,
  normalizeOptionalString,
  normalizeRequiredString,
  parseJsonBody,
  requireObjectBody,
} from '@/lib/api'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      filings: {
        orderBy: { filedAt: 'desc' },
        take: 10,
        include: {
          _count: { select: { transactions: true } },
        },
      },
      _count: { select: { filings: true } },
    },
  })

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  return NextResponse.json(entity)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = requireObjectBody(await parseJsonBody(req))
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid request body')
  }

  const { name, description, tracked } = body

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) {
    try {
      updateData.name = normalizeRequiredString(name, 'name')
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : 'Invalid name')
    }
  }
  if (description !== undefined) {
    try {
      updateData.description = normalizeOptionalString(description, 'description')
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : 'Invalid description')
    }
  }
  if (tracked !== undefined) {
    if (typeof tracked !== 'boolean') {
      return badRequest('tracked must be a boolean')
    }
    updateData.tracked = tracked
  }

  try {
    const entity = await prisma.entity.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(entity)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  try {
    await prisma.entity.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

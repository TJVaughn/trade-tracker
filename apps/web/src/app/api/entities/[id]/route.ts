import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import { badRequest } from '@/lib/api'

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
  const body = await req.json()
  const { name, description, tracked } = body

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('name must be a non-empty string')
    }
    updateData.name = name.trim()
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return badRequest('description must be a string or null')
    }
    updateData.description = description?.trim() || null
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

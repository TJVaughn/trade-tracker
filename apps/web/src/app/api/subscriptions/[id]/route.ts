import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const body = await req.json()
  const { active, formTypes } = body

  const updateData: Record<string, unknown> = {}
  if (active !== undefined) updateData.active = active
  if (formTypes !== undefined) {
    if (!Array.isArray(formTypes) || formTypes.length === 0) {
      return NextResponse.json({ error: 'formTypes must be a non-empty array' }, { status: 400 })
    }
    updateData.formTypes = formTypes
  }

  try {
    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: { entity: true },
    })
    return NextResponse.json(subscription)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  try {
    await prisma.subscription.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

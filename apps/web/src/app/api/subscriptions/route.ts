import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

export async function GET() {
  const subscriptions = await prisma.subscription.findMany({
    include: { entity: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(subscriptions)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, endpoint, entityId, formTypes } = body

  if (!type || !endpoint) {
    return NextResponse.json({ error: 'type and endpoint are required' }, { status: 400 })
  }

  if (!['NTFY', 'EMAIL'].includes(type)) {
    return NextResponse.json({ error: 'type must be NTFY or EMAIL' }, { status: 400 })
  }

  if (type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endpoint)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const resolvedFormTypes: string[] =
    Array.isArray(formTypes) && formTypes.length > 0
      ? formTypes
      : ['FORM_4', 'FORM_13F', 'SCHEDULE_13DG']

  try {
    const subscription = await prisma.subscription.create({
      data: {
        type,
        endpoint,
        entityId: entityId || null,
        formTypes: resolvedFormTypes,
        active: true,
      },
      include: { entity: true },
    })
    return NextResponse.json(subscription, { status: 201 })
  } catch (err: unknown) {
    console.error('Failed to create subscription:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import {
  badRequest,
  FORM_TYPES,
  isFormType,
  isNotificationType,
} from '@/lib/api'

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
    return NextResponse.json(
      { error: 'type and endpoint are required' },
      { status: 400 },
    )
  }

  if (typeof endpoint !== 'string' || endpoint.trim().length === 0) {
    return badRequest('endpoint must be a non-empty string')
  }

  if (!isNotificationType(type)) {
    return badRequest('type must be NTFY or EMAIL')
  }

  if (type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endpoint)) {
    return badRequest('Invalid email address')
  }

  if (
    formTypes !== undefined &&
    (!Array.isArray(formTypes) || !formTypes.every(isFormType))
  ) {
    return badRequest(
      'formTypes must contain only FORM_4, FORM_13F, or SCHEDULE_13DG',
    )
  }

  const resolvedFormTypes =
    Array.isArray(formTypes) && formTypes.length > 0
      ? formTypes
      : [...FORM_TYPES]

  try {
    const subscription = await prisma.subscription.create({
      data: {
        type,
        endpoint: endpoint.trim(),
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

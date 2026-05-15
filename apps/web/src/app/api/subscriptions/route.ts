import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'
import {
  badRequest,
  FORM_TYPES,
  isFormType,
  isNotificationType,
  normalizeEmailAddress,
  normalizeNtfyTopic,
  parseJsonBody,
  requireObjectBody,
} from '@/lib/api'

export async function GET() {
  const subscriptions = await prisma.subscription.findMany({
    include: { entity: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(subscriptions)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = requireObjectBody(await parseJsonBody(req))
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid request body')
  }

  const { type, endpoint, entityId, formTypes } = body

  if (!type || !endpoint) {
    return NextResponse.json(
      { error: 'type and endpoint are required' },
      { status: 400 },
    )
  }

  if (typeof endpoint !== 'string') {
    return badRequest('endpoint must be a string')
  }

  if (!isNotificationType(type)) {
    return badRequest('type must be NTFY or EMAIL')
  }

  let normalizedEndpoint: string
  try {
    normalizedEndpoint =
      type === 'EMAIL' ? normalizeEmailAddress(endpoint) : normalizeNtfyTopic(endpoint)
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid endpoint')
  }

  if (entityId !== undefined && entityId !== null && typeof entityId !== 'string') {
    return badRequest('entityId must be a string or null')
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
        endpoint: normalizedEndpoint,
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

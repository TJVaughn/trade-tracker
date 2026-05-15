import { NextRequest, NextResponse } from 'next/server'

export const FORM_TYPES = ['FORM_4', 'FORM_13F', 'SCHEDULE_13DG'] as const
export const ENTITY_TYPES = ['PERSON', 'COMPANY'] as const
export const NOTIFICATION_TYPES = ['NTFY', 'EMAIL'] as const

export const MAX_TEXT_LENGTH = 512
export const MAX_DESCRIPTION_LENGTH = 2_000
export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export type FormTypeValue = (typeof FORM_TYPES)[number]
export type EntityTypeValue = (typeof ENTITY_TYPES)[number]
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number]

export function isFormType(value: unknown): value is FormTypeValue {
  return typeof value === 'string' && FORM_TYPES.includes(value as FormTypeValue)
}

export function isEntityType(value: unknown): value is EntityTypeValue {
  return typeof value === 'string' && ENTITY_TYPES.includes(value as EntityTypeValue)
}

export function isNotificationType(value: unknown): value is NotificationTypeValue {
  return (
    typeof value === 'string' &&
    NOTIFICATION_TYPES.includes(value as NotificationTypeValue)
  )
}

export async function parseJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

export function requireObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object')
  }
  return body as Record<string, unknown>
}

export function normalizeRequiredString(
  value: unknown,
  name: string,
  maxLength = MAX_TEXT_LENGTH,
): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${name} must be a non-empty string`)
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${name} must be ${maxLength} characters or fewer`)
  }

  return trimmed
}

export function normalizeOptionalString(
  value: unknown,
  name: string,
  maxLength = MAX_DESCRIPTION_LENGTH,
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string or null`)
  }

  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new Error(`${name} must be ${maxLength} characters or fewer`)
  }

  return trimmed || null
}

export function normalizeEmailAddress(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length > 254) {
    throw new Error('Invalid email address')
  }
  if (/\r|\n/.test(trimmed)) {
    throw new Error('Invalid email address')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Invalid email address')
  }
  return trimmed
}

export function normalizeNtfyTopic(value: string): string {
  const trimmed = value.trim()
  if (!NTFY_TOPIC_PATTERN.test(trimmed)) {
    throw new Error(
      'ntfy topic must be 1-64 characters using only letters, numbers, underscores, or hyphens',
    )
  }
  return trimmed
}

export function parsePositiveIntParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  maxValue = 100,
): number {
  const rawValue = searchParams.get(name)
  if (rawValue == null) return defaultValue

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }

  return Math.min(value, maxValue)
}

export function parseDateParam(
  searchParams: URLSearchParams,
  name: string,
): Date | undefined {
  const rawValue = searchParams.get(name)
  if (!rawValue) return undefined

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    throw new Error(`${name} must be a valid date in YYYY-MM-DD format`)
  }

  const date = new Date(`${rawValue}T00:00:00.000Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== rawValue
  ) {
    throw new Error(`${name} must be a valid date in YYYY-MM-DD format`)
  }

  return date
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

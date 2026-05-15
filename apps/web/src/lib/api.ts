import { NextResponse } from 'next/server'

export const FORM_TYPES = ['FORM_4', 'FORM_13F', 'SCHEDULE_13DG'] as const
export const ENTITY_TYPES = ['PERSON', 'COMPANY'] as const
export const NOTIFICATION_TYPES = ['NTFY', 'EMAIL'] as const

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

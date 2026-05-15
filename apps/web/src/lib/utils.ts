import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatShares(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function transactionCodeLabel(code: string): string {
  const labels: Record<string, string> = {
    P: 'Purchase', S: 'Sale', A: 'Award', D: 'Disposed',
    F: 'Tax W/H', M: 'Exercise', C: 'Convert', G: 'Gift', J: 'Other',
    '13F': 'Holding', '13D': 'SC 13D', '13G': 'SC 13G',
  }
  return labels[code] ?? code
}

export function transactionCodeColor(code: string): string {
  if (['P', 'A', 'M', 'C'].includes(code)) return 'green'
  if (['S', 'D', 'F'].includes(code)) return 'red'
  return 'gray'
}

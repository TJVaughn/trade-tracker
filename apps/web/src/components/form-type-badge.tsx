'use client'
import { cn } from '@/lib/utils'

const styles: Record<string, string> = {
  FORM_4: 'bg-blue-100 text-blue-800 border-blue-200',
  FORM_13F: 'bg-purple-100 text-purple-800 border-purple-200',
  SCHEDULE_13DG: 'bg-orange-100 text-orange-800 border-orange-200',
}

const labels: Record<string, string> = {
  FORM_4: 'Form 4',
  FORM_13F: 'Form 13F',
  SCHEDULE_13DG: '13D/G',
}

export function FormTypeBadge({ formType }: { formType: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', styles[formType] ?? 'bg-gray-100 text-gray-800')}>
      {labels[formType] ?? formType}
    </span>
  )
}

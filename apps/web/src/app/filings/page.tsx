import { prisma } from '@trade-tracker/db'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FormTypeBadge } from '@/components/form-type-badge'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface Props {
  searchParams: Promise<{
    formType?: string
    entityId?: string
    page?: string
  }>
}

export default async function FilingsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const formType = params.formType || undefined
  const entityId = params.entityId || undefined

  const where = {
    ...(formType ? { formType: formType as 'FORM_4' | 'FORM_13F' | 'SCHEDULE_13DG' } : {}),
    ...(entityId ? { entityId } : {}),
  }

  const [filings, total, entities] = await Promise.all([
    prisma.filing.findMany({
      where,
      include: {
        entity: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { filedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.filing.count({ where }),
    prisma.entity.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = { formType, entityId, page: String(page), ...updates }
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v)
    }
    return `/filings?${p.toString()}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Filings</h1>
        <p className="text-gray-400 text-sm mt-1">{total.toLocaleString()} total filings</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Form Type:</span>
          <div className="flex gap-1.5">
            {[
              { value: '', label: 'All' },
              { value: 'FORM_4', label: 'Form 4' },
              { value: 'FORM_13F', label: '13F' },
              { value: 'SCHEDULE_13DG', label: '13D/G' },
            ].map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ formType: opt.value || undefined, page: '1' })}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  (formType ?? '') === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {entityId && (
          <Link
            href={buildUrl({ entityId: undefined, page: '1' })}
            className="px-3 py-1 rounded text-xs font-medium bg-purple-900 text-purple-300 hover:bg-purple-800"
          >
            Clear entity filter ×
          </Link>
        )}
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-0">
          <CardTitle className="text-gray-100 text-lg">
            Filings {page > 1 && `(Page ${page})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Form Type</TableHead>
                <TableHead className="text-gray-400">Entity</TableHead>
                <TableHead className="text-gray-400">Issuer</TableHead>
                <TableHead className="text-gray-400">Filed At</TableHead>
                <TableHead className="text-gray-400 text-right"># Txns</TableHead>
                <TableHead className="text-gray-400">Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No filings found.
                  </TableCell>
                </TableRow>
              )}
              {filings.map((filing) => (
                <TableRow key={filing.id} className="border-gray-700 hover:bg-gray-750">
                  <TableCell>
                    <Link href={`/filings/${filing.id}`}>
                      <FormTypeBadge formType={filing.formType} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/entities/${filing.entity.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      {filing.entity.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {filing.issuerName ?? '—'}
                    {filing.issuerTicker && (
                      <span className="ml-1 text-gray-500 text-xs">({filing.issuerTicker})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">{formatDate(filing.filedAt)}</TableCell>
                  <TableCell className="text-gray-300 text-right">
                    {filing._count.transactions.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {filing.processed ? (
                      <span className="inline-flex items-center rounded-full bg-green-900 text-green-300 px-2.5 py-0.5 text-xs font-semibold">
                        Yes
                      </span>
                    ) : filing.processingError ? (
                      <span className="inline-flex items-center rounded-full bg-red-900 text-red-300 px-2.5 py-0.5 text-xs font-semibold">
                        Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-900 text-yellow-300 px-2.5 py-0.5 text-xs font-semibold">
                        Pending
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
            >
              {page > 1 ? (
                <Link href={buildUrl({ page: String(page - 1) })}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span><ChevronLeft className="h-4 w-4" />Previous</span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
            >
              {page < totalPages ? (
                <Link href={buildUrl({ page: String(page + 1) })}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span>Next<ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

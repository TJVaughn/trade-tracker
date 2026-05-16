import { prisma } from '@trade-tracker/db'
import Link from 'next/link'
import { subDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  formatCurrency,
  formatShares,
  formatDate,
  transactionCodeLabel,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const BUY_CODES = ['P', 'A', 'M', 'C']

const PERIODS: { label: string; value: string; days: number | null }[] = [
  { label: '7 days', value: '7', days: 7 },
  { label: '30 days', value: '30', days: 30 },
  { label: '90 days', value: '90', days: 90 },
  { label: 'All time', value: 'all', days: null },
]

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Largest value', value: 'value' },
  { label: 'Most recent', value: 'date' },
]

interface Props {
  searchParams: Promise<{
    period?: string
    sort?: string
    page?: string
    code?: string
  }>
}

export default async function BuysPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const period = PERIODS.find((p) => p.value === params.period) ?? PERIODS[1]
  const sort = params.sort === 'date' ? 'date' : 'value'
  const code = BUY_CODES.includes(params.code ?? '') ? params.code : undefined

  const since = period.days ? subDays(new Date(), period.days) : undefined

  const where = {
    transactionCode: code ? code : { in: BUY_CODES },
    totalValue: { not: null },
    ...(since ? { transactionDate: { gte: since } } : {}),
  }

  const orderBy =
    sort === 'value'
      ? [{ totalValue: 'desc' as const }, { transactionDate: 'desc' as const }]
      : [{ transactionDate: 'desc' as const }]

  const [transactions, total, stats] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        filing: {
          include: { entity: true },
        },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where,
      _sum: { totalValue: true },
      _count: true,
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const totalValue = stats._sum.totalValue ? Number(stats._sum.totalValue) : 0

  function buildUrl(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = {
      period: period.value,
      sort,
      page: String(page),
      code,
      ...updates,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v)
    }
    return `/buys?${p.toString()}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Insider Buys</h1>
        <p className="text-gray-400 text-sm mt-1">
          {total.toLocaleString()} transactions &nbsp;·&nbsp; {formatCurrency(totalValue)} total value
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Period:</span>
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <Link
                key={p.value}
                href={buildUrl({ period: p.value, page: '1' })}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period.value === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Type:</span>
          <div className="flex gap-1.5">
            <Link
              href={buildUrl({ code: undefined, page: '1' })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                !code
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All buys
            </Link>
            {BUY_CODES.map((c) => (
              <Link
                key={c}
                href={buildUrl({ code: c, page: '1' })}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  code === c
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {transactionCodeLabel(c)}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Sort:</span>
          <div className="flex gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ sort: opt.value, page: '1' })}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  sort === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-0">
          <CardTitle className="text-gray-100 text-lg">
            Buys {page > 1 && `(Page ${page})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Insider</TableHead>
                <TableHead className="text-gray-400">Company</TableHead>
                <TableHead className="text-gray-400">Security</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400 text-right">Shares</TableHead>
                <TableHead className="text-gray-400 text-right">Price</TableHead>
                <TableHead className="text-gray-400 text-right">Total Value</TableHead>
                <TableHead className="text-gray-400 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    No buy transactions found.
                  </TableCell>
                </TableRow>
              )}
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="border-gray-700 hover:bg-gray-750">
                  <TableCell>
                    <Link
                      href={`/entities/${tx.filing.entity.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      {tx.filing.entity.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {tx.filing.issuerName ?? '—'}
                    {tx.filing.issuerTicker && (
                      <span className="ml-1 text-gray-500 text-xs">
                        ({tx.filing.issuerTicker})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm max-w-[160px] truncate">
                    {tx.securityTitle}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-green-900 text-green-300">
                      {transactionCodeLabel(tx.transactionCode)}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm text-right">
                    {formatShares(tx.shares ? Number(tx.shares) : null)}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm text-right">
                    {tx.pricePerShare ? formatCurrency(Number(tx.pricePerShare)) : '—'}
                  </TableCell>
                  <TableCell className="text-gray-100 text-sm font-medium text-right">
                    {tx.totalValue ? formatCurrency(Number(tx.totalValue)) : '—'}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm text-right whitespace-nowrap">
                    {formatDate(tx.transactionDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
            {total.toLocaleString()}
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
                <span>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
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
                <span>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

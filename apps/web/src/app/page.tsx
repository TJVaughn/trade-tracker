import { prisma } from '@trade-tracker/db'
import { subDays, format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormTypeBadge } from '@/components/form-type-badge'
import { VolumeChart } from '@/components/volume-chart'
import {
  formatCurrency,
  formatShares,
  formatRelative,
  transactionCodeLabel,
  transactionCodeColor,
} from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const sevenDaysAgo = subDays(new Date(), 7)
  const fourteenDaysAgo = subDays(new Date(), 14)

  const [
    trackedEntitiesCount,
    filingsThisWeekCount,
    transactionsThisWeek,
    buyAgg,
    sellAgg,
    recentTransactions,
    rawDailyData,
  ] = await Promise.all([
    prisma.entity.count({ where: { tracked: true } }),
    prisma.filing.count({ where: { filedAt: { gte: sevenDaysAgo } } }),
    prisma.transaction.count({
      where: { filing: { filedAt: { gte: sevenDaysAgo } } },
    }),
    prisma.transaction.aggregate({
      where: {
        transactionCode: { in: ['P', 'A', 'M'] },
        filing: { filedAt: { gte: sevenDaysAgo } },
        totalValue: { not: null },
      },
      _sum: { totalValue: true },
    }),
    prisma.transaction.aggregate({
      where: {
        transactionCode: { in: ['S', 'D'] },
        filing: { filedAt: { gte: sevenDaysAgo } },
        totalValue: { not: null },
      },
      _sum: { totalValue: true },
    }),
    prisma.transaction.findMany({
      take: 20,
      orderBy: { transactionDate: 'desc' },
      include: {
        filing: {
          include: { entity: true },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        transactionDate: { gte: fourteenDaysAgo },
        totalValue: { not: null },
      },
      select: {
        transactionDate: true,
        transactionCode: true,
        totalValue: true,
      },
    }),
  ])

  // Build 14-day volume chart data
  const volumeMap = new Map<string, { buyVolume: number; sellVolume: number }>()
  for (let i = 13; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'MMM d')
    volumeMap.set(d, { buyVolume: 0, sellVolume: 0 })
  }

  for (const tx of rawDailyData) {
    const key = format(new Date(tx.transactionDate), 'MMM d')
    const entry = volumeMap.get(key)
    if (!entry) continue
    const val = tx.totalValue ? Number(tx.totalValue) : 0
    if (['P', 'A', 'M', 'C'].includes(tx.transactionCode)) {
      entry.buyVolume += val
    } else if (['S', 'D', 'F'].includes(tx.transactionCode)) {
      entry.sellVolume += val
    }
  }

  const volumeData = Array.from(volumeMap.entries()).map(([date, vals]) => ({
    date,
    buyVolume: vals.buyVolume,
    sellVolume: vals.sellVolume,
  }))

  const buyTotal = buyAgg._sum.totalValue ? Number(buyAgg._sum.totalValue) : 0
  const sellTotal = sellAgg._sum.totalValue ? Number(sellAgg._sum.totalValue) : 0

  // Serialize transactions for client
  const serializedTransactions = recentTransactions.map((tx) => ({
    id: tx.id,
    transactionDate: tx.transactionDate.toISOString(),
    securityTitle: tx.securityTitle,
    transactionCode: tx.transactionCode,
    shares: tx.shares ? Number(tx.shares) : null,
    pricePerShare: tx.pricePerShare ? Number(tx.pricePerShare) : null,
    totalValue: tx.totalValue ? Number(tx.totalValue) : null,
    filing: {
      id: tx.filing.id,
      formType: tx.filing.formType,
      issuerName: tx.filing.issuerName ?? null,
      entity: {
        id: tx.filing.entity.id,
        name: tx.filing.entity.name,
      },
    },
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">SEC insider trade monitoring overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 font-medium">Tracked Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-100">{trackedEntitiesCount.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 font-medium">Filings This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-100">{filingsThisWeekCount.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 font-medium">Transactions This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-100">{transactionsThisWeek.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 font-medium">Buy / Sell Value This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-green-400">{formatCurrency(buyTotal)}</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(sellTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">14-Day Trade Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <VolumeChart data={volumeData} />
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-700">
            {serializedTransactions.length === 0 && (
              <p className="text-gray-400 text-sm p-6">No recent transactions found.</p>
            )}
            {serializedTransactions.map((tx) => {
              const color = transactionCodeColor(tx.transactionCode)
              const colorClass =
                color === 'green'
                  ? 'bg-green-900 text-green-300'
                  : color === 'red'
                  ? 'bg-red-900 text-red-300'
                  : 'bg-gray-700 text-gray-300'
              return (
                <div key={tx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-750">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/entities/${tx.filing.entity.id}`}
                        className="font-medium text-gray-100 hover:text-blue-400 text-sm"
                      >
                        {tx.filing.entity.name}
                      </Link>
                      <FormTypeBadge formType={tx.filing.formType} />
                      {tx.filing.issuerName && (
                        <span className="text-gray-400 text-xs">{tx.filing.issuerName}</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5">{tx.securityTitle}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
                      {transactionCodeLabel(tx.transactionCode)}
                    </span>
                    <span className="text-gray-300 text-sm text-right">
                      {formatShares(tx.shares)} shares
                    </span>
                    {tx.pricePerShare != null && (
                      <span className="text-gray-400 text-xs">@ {formatCurrency(tx.pricePerShare)}</span>
                    )}
                    {tx.totalValue != null && (
                      <span className="text-gray-100 text-sm font-medium">{formatCurrency(tx.totalValue)}</span>
                    )}
                    <span className="text-gray-500 text-xs w-24 text-right">{formatRelative(tx.transactionDate)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

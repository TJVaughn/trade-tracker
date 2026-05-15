import { prisma } from '@trade-tracker/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormTypeBadge } from '@/components/form-type-badge'
import {
  formatDate,
  formatCurrency,
  formatShares,
  formatRelative,
  transactionCodeLabel,
  transactionCodeColor,
} from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EntityDetailPage({ params }: Props) {
  const { id } = await params

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      filings: {
        orderBy: { filedAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { transactions: true } },
        },
      },
    },
  })

  if (!entity) notFound()

  const recentTransactions = await prisma.transaction.findMany({
    where: { filing: { entityId: id } },
    orderBy: { transactionDate: 'desc' },
    take: 10,
    include: {
      filing: { select: { formType: true, issuerName: true, id: true } },
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Entity Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100">{entity.name}</h1>
            <Badge
              variant="outline"
              className={
                entity.type === 'PERSON'
                  ? 'border-sky-600 text-sky-400'
                  : 'border-violet-600 text-violet-400'
              }
            >
              {entity.type === 'PERSON' ? 'Person' : 'Company'}
            </Badge>
            {entity.tracked && (
              <span className="inline-flex items-center rounded-full bg-green-900 text-green-300 px-2.5 py-0.5 text-xs font-semibold">
                Tracked
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm font-mono">CIK: {entity.cik}</p>
          {entity.description && (
            <p className="text-gray-300 text-sm max-w-2xl">{entity.description}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="filings">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="filings" className="text-gray-300 data-[state=active]:text-gray-100">
            Filings ({entity.filings.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-gray-300 data-[state=active]:text-gray-100">
            Recent Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filings" className="mt-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-0">
              <CardTitle className="text-gray-100 text-lg">Filings</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-400">Form Type</TableHead>
                    <TableHead className="text-gray-400">Issuer</TableHead>
                    <TableHead className="text-gray-400">Filed</TableHead>
                    <TableHead className="text-gray-400 text-right"># Txns</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entity.filings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        No filings found.
                      </TableCell>
                    </TableRow>
                  )}
                  {entity.filings.map((filing) => (
                    <TableRow key={filing.id} className="border-gray-700 hover:bg-gray-750">
                      <TableCell>
                        <Link href={`/filings/${filing.id}`}>
                          <FormTypeBadge formType={filing.formType} />
                        </Link>
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {filing.issuerName ?? '—'}
                        {filing.issuerTicker && (
                          <span className="ml-1 text-gray-500">({filing.issuerTicker})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{formatDate(filing.filedAt)}</TableCell>
                      <TableCell className="text-gray-300 text-right">
                        {filing._count.transactions.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {filing.processed ? (
                          <span className="inline-flex items-center rounded-full bg-green-900 text-green-300 px-2.5 py-0.5 text-xs font-semibold">
                            Processed
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
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-0">
              <CardTitle className="text-gray-100 text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700 hover:bg-transparent">
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Security</TableHead>
                    <TableHead className="text-gray-400">Code</TableHead>
                    <TableHead className="text-gray-400 text-right">Shares</TableHead>
                    <TableHead className="text-gray-400 text-right">Price</TableHead>
                    <TableHead className="text-gray-400 text-right">Total Value</TableHead>
                    <TableHead className="text-gray-400">Filing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                  {recentTransactions.map((tx) => {
                    const color = transactionCodeColor(tx.transactionCode)
                    const colorClass =
                      color === 'green'
                        ? 'bg-green-900 text-green-300'
                        : color === 'red'
                        ? 'bg-red-900 text-red-300'
                        : 'bg-gray-700 text-gray-300'
                    return (
                      <TableRow key={tx.id} className="border-gray-700 hover:bg-gray-750">
                        <TableCell className="text-gray-400 text-sm whitespace-nowrap">
                          {formatDate(tx.transactionDate)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">{tx.securityTitle}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
                            {transactionCodeLabel(tx.transactionCode)}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-300 text-right text-sm">
                          {formatShares(tx.shares ? Number(tx.shares) : null)}
                        </TableCell>
                        <TableCell className="text-gray-400 text-right text-sm">
                          {formatCurrency(tx.pricePerShare ? Number(tx.pricePerShare) : null)}
                        </TableCell>
                        <TableCell className="text-gray-100 text-right text-sm font-medium">
                          {formatCurrency(tx.totalValue ? Number(tx.totalValue) : null)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/filings/${tx.filing.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                            <FormTypeBadge formType={tx.filing.formType} />
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

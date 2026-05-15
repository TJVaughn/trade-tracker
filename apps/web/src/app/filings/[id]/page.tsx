import { prisma } from '@trade-tracker/db'
import { notFound } from 'next/navigation'
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
import {
  formatDate,
  formatCurrency,
  formatShares,
  transactionCodeLabel,
  transactionCodeColor,
} from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FilingDetailPage({ params }: Props) {
  const { id } = await params

  const filing = await prisma.filing.findUnique({
    where: { id },
    include: {
      entity: true,
      transactions: {
        orderBy: { transactionDate: 'desc' },
      },
    },
  })

  if (!filing) notFound()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Filing Header */}
      <div className="space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          <FormTypeBadge formType={filing.formType} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-100 font-mono">{filing.accessionNumber}</h1>
              {filing.rawUrl && (
                <a
                  href={filing.rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  SEC Filing <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
              <span>
                Entity:{' '}
                <Link
                  href={`/entities/${filing.entity.id}`}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  {filing.entity.name}
                </Link>
              </span>
              {filing.issuerName && (
                <span>
                  Issuer: <span className="text-gray-300">{filing.issuerName}</span>
                  {filing.issuerTicker && (
                    <span className="text-gray-500 ml-1">({filing.issuerTicker})</span>
                  )}
                </span>
              )}
              {filing.issuerCik && (
                <span>Issuer CIK: <span className="text-gray-300 font-mono">{filing.issuerCik}</span></span>
              )}
              <span>Filed: <span className="text-gray-300">{formatDate(filing.filedAt)}</span></span>
              {filing.periodOfReport && (
                <span>Period: <span className="text-gray-300">{formatDate(filing.periodOfReport)}</span></span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {filing.processed ? (
              <span className="inline-flex items-center rounded-full bg-green-900 text-green-300 px-2.5 py-0.5 text-xs font-semibold">
                Processed
              </span>
            ) : filing.processingError ? (
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-red-900 text-red-300 px-2.5 py-0.5 text-xs font-semibold">
                  Processing Error
                </span>
                <p className="text-red-400 text-xs max-w-xs">{filing.processingError}</p>
              </div>
            ) : (
              <span className="inline-flex items-center rounded-full bg-yellow-900 text-yellow-300 px-2.5 py-0.5 text-xs font-semibold">
                Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-0">
          <CardTitle className="text-gray-100 text-lg">
            Transactions ({filing.transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Security</TableHead>
                <TableHead className="text-gray-400">Code</TableHead>
                <TableHead className="text-gray-400 text-right">Shares</TableHead>
                <TableHead className="text-gray-400 text-right">Price/Share</TableHead>
                <TableHead className="text-gray-400 text-right">Total Value</TableHead>
                <TableHead className="text-gray-400">Ownership</TableHead>
                <TableHead className="text-gray-400 text-right">Shares After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filing.transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    No transactions found for this filing.
                  </TableCell>
                </TableRow>
              )}
              {filing.transactions.map((tx) => {
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
                    <TableCell className="text-gray-300 text-sm">
                      <div>{tx.securityTitle}</div>
                      {tx.footnote && (
                        <div className="text-gray-500 text-xs mt-0.5">{tx.footnote}</div>
                      )}
                    </TableCell>
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
                    <TableCell className="text-gray-400 text-sm">{tx.ownershipForm}</TableCell>
                    <TableCell className="text-gray-300 text-right text-sm">
                      {formatShares(tx.sharesOwnedAfter ? Number(tx.sharesOwnedAfter) : null)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

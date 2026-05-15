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
import { Badge } from '@/components/ui/badge'
import { AddEntityDialog } from './add-entity-dialog'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EntitiesPage() {
  const entities = await prisma.entity.findMany({
    include: {
      _count: { select: { filings: true } },
      filings: {
        orderBy: { filedAt: 'desc' },
        take: 1,
        select: { filedAt: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Entities</h1>
          <p className="text-gray-400 text-sm mt-1">{entities.length} total entities</p>
        </div>
        <AddEntityDialog />
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-0">
          <CardTitle className="text-gray-100 text-lg">All Entities</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">CIK</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400 text-right"># Filings</TableHead>
                <TableHead className="text-gray-400">Last Filed</TableHead>
                <TableHead className="text-gray-400">Tracked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No entities found. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
              {entities.map((entity) => (
                <TableRow key={entity.id} className="border-gray-700 hover:bg-gray-750">
                  <TableCell>
                    <Link
                      href={`/entities/${entity.id}`}
                      className="font-medium text-blue-400 hover:text-blue-300"
                    >
                      {entity.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-300 font-mono text-sm">{entity.cik}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-gray-300 text-right">
                    {entity._count.filings.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {entity.filings[0] ? formatDate(entity.filings[0].filedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    {entity.tracked ? (
                      <span className="inline-flex items-center rounded-full bg-green-900 text-green-300 px-2.5 py-0.5 text-xs font-semibold">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-700 text-gray-400 px-2.5 py-0.5 text-xs font-semibold">
                        No
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

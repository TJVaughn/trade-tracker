import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@trade-tracker/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
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

  if (!filing) {
    return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
  }

  return NextResponse.json(filing)
}

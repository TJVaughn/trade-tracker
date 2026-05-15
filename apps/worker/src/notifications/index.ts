import { prisma, FormType, NotificationType } from '@trade-tracker/db'
import { sendNtfy } from './ntfy'
import { sendEmail } from './email'

export interface FilingWithEntity {
  id: string
  accessionNumber: string
  formType: FormType
  filedAt: Date
  issuerName: string | null
  issuerTicker: string | null
  entity: {
    id: string
    name: string
    cik: string
  }
  transactions: Array<{
    transactionCode: string
    securityTitle: string
    shares: unknown // Decimal from Prisma
    pricePerShare: unknown | null
    totalValue: unknown | null
    transactionDate: Date
  }>
}

function stripHeaderNewlines(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formTypeLabel(ft: FormType): string {
  switch (ft) {
    case FormType.FORM_4:
      return 'Form 4'
    case FormType.FORM_13F:
      return 'Form 13F'
    case FormType.SCHEDULE_13DG:
      return 'Schedule 13D/G'
    default:
      return ft
  }
}

function transactionSummary(filing: FilingWithEntity): string {
  if (filing.transactions.length === 0) return 'No transactions recorded.'

  return filing.transactions
    .slice(0, 5) // cap at 5 for notification brevity
    .map((t) => {
      const shares = parseFloat(String(t.shares))
      const price = t.pricePerShare != null ? parseFloat(String(t.pricePerShare)) : null
      const total = t.totalValue != null ? parseFloat(String(t.totalValue)) : null

      const shareLine = shares !== 0 ? `${shares.toLocaleString()} shares` : ''
      const priceLine = price != null ? `@ $${price.toFixed(2)}` : ''
      const totalLine =
        total != null
          ? `(total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : ''

      return `  • [${t.transactionCode}] ${t.securityTitle}: ${[shareLine, priceLine, totalLine].filter(Boolean).join(' ')}`
    })
    .join('\n')
}

function buildNtfyMessage(filing: FilingWithEntity): string {
  const lines = [
    `Entity: ${filing.entity.name}`,
    `Filed: ${filing.filedAt.toISOString().split('T')[0]}`,
  ]
  if (filing.issuerName) lines.push(`Issuer: ${filing.issuerName}`)
  if (filing.issuerTicker) lines.push(`Ticker: ${filing.issuerTicker}`)
  if (filing.transactions.length > 0) {
    lines.push('', 'Transactions:')
    lines.push(transactionSummary(filing))
  }
  return lines.join('\n')
}

function buildEmailHtml(filing: FilingWithEntity): string {
  const txRows = filing.transactions
    .slice(0, 20)
    .map((t) => {
      const shares = parseFloat(String(t.shares))
      const price = t.pricePerShare != null ? parseFloat(String(t.pricePerShare)) : null
      const total = t.totalValue != null ? parseFloat(String(t.totalValue)) : null
      return `
        <tr>
          <td style="padding:4px 8px;border:1px solid #ddd">${t.transactionDate.toISOString().split('T')[0]}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(t.transactionCode)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${escapeHtml(t.securityTitle)}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${shares.toLocaleString()}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${price != null ? '$' + price.toFixed(2) : '—'}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${total != null ? '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
        </tr>`
    })
    .join('')

  const moreNote =
    filing.transactions.length > 20
      ? `<p><em>...and ${filing.transactions.length - 20} more transactions.</em></p>`
      : ''

  return `
    <html><body style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h2>New ${escapeHtml(formTypeLabel(filing.formType))} Filing</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <tr><th style="text-align:left;padding:4px 8px">Entity</th><td style="padding:4px 8px">${escapeHtml(filing.entity.name)}</td></tr>
        <tr><th style="text-align:left;padding:4px 8px">Accession</th><td style="padding:4px 8px"><code>${escapeHtml(filing.accessionNumber)}</code></td></tr>
        <tr><th style="text-align:left;padding:4px 8px">Filed</th><td style="padding:4px 8px">${filing.filedAt.toISOString().split('T')[0]}</td></tr>
        ${filing.issuerName ? `<tr><th style="text-align:left;padding:4px 8px">Issuer</th><td style="padding:4px 8px">${escapeHtml(filing.issuerName)}${filing.issuerTicker ? ` (${escapeHtml(filing.issuerTicker)})` : ''}</td></tr>` : ''}
      </table>
      ${
        filing.transactions.length > 0
          ? `<h3>Transactions</h3>
             <table style="border-collapse:collapse;width:100%">
               <thead><tr style="background:#f5f5f5">
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Date</th>
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Code</th>
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Security</th>
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Shares</th>
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Price</th>
                 <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">Total Value</th>
               </tr></thead>
               <tbody>${txRows}</tbody>
             </table>
             ${moreNote}`
          : '<p>No transaction details available.</p>'
      }
    </body></html>`
}

function ntfyTags(filing: FilingWithEntity): string[] {
  const tags: string[] = ['chart_with_upwards_trend']
  switch (filing.formType) {
    case FormType.FORM_4:
      tags.push('form4')
      break
    case FormType.FORM_13F:
      tags.push('form13f')
      break
    case FormType.SCHEDULE_13DG:
      tags.push('schedule13dg')
      break
  }
  return tags
}

/**
 * Notify all active subscribers about a new filing.
 * Matches subscriptions where entityId is null (global) or matches the filing's entity.
 */
export async function notifyNewFiling(filing: FilingWithEntity): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      active: true,
      OR: [{ entityId: null }, { entityId: filing.entity.id }],
    },
  })

  // Filter by formType if the subscription specifies form types
  const relevant = subscriptions.filter(
    (sub) =>
      sub.formTypes.length === 0 || sub.formTypes.includes(filing.formType),
  )

  const title = stripHeaderNewlines(
    `New ${formTypeLabel(filing.formType)}: ${filing.entity.name}`,
  )

  await Promise.allSettled(
    relevant.map(async (sub) => {
      try {
        if (sub.type === NotificationType.NTFY) {
          await sendNtfy({
            topic: sub.endpoint,
            title,
            message: buildNtfyMessage(filing),
            priority: 'default',
            tags: ntfyTags(filing),
          })
        } else if (sub.type === NotificationType.EMAIL) {
          await sendEmail(sub.endpoint, title, buildEmailHtml(filing))
        }
      } catch (err) {
        console.error(
          `Failed to send ${sub.type} notification to ${sub.endpoint}:`,
          err,
        )
      }
    }),
  )
}

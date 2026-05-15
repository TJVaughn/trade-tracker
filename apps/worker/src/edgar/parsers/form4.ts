import { XMLParser } from 'fast-xml-parser'

export interface Form4Transaction {
  transactionDate: Date
  securityTitle: string
  transactionCode: string
  shares: number
  pricePerShare: number | null
  totalValue: number | null
  sharesOwnedAfter: number | null
  ownershipForm: string
  footnote: string | null
  isDerivative: boolean
}

export interface ParsedForm4 {
  issuerCik: string | null
  issuerName: string | null
  issuerTicker: string | null
  reportingOwnerCik: string | null
  transactions: Form4Transaction[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // SEC XML uses nested <value> tags; we want those as plain text
  isArray: (name) =>
    name === 'nonDerivativeTransaction' ||
    name === 'derivativeTransaction' ||
    name === 'footnote',
})

/**
 * Safely dig into a nested SEC "value wrapper" object.
 * SEC XML patterns: <foo><value>bar</value></foo>  → { value: "bar" }
 */
function secVal(obj: unknown): string | null {
  if (obj == null) return null
  if (typeof obj === 'string' || typeof obj === 'number') return String(obj)
  if (typeof obj === 'object' && 'value' in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>).value
    return v == null ? null : String(v)
  }
  return null
}

function parseDecimal(obj: unknown): number | null {
  const s = secVal(obj)
  if (s == null || s === '') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseDate(obj: unknown): Date {
  const s = secVal(obj)
  if (!s) return new Date()
  // Dates from SEC are YYYY-MM-DD
  const d = new Date(s + 'T00:00:00.000Z')
  return isNaN(d.getTime()) ? new Date() : d
}

function extractNonDerivative(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txn: any,
): Form4Transaction | null {
  try {
    const secTitle = secVal(txn.securityTitle) ?? 'Unknown'
    const txnDate = parseDate(txn.transactionDate)
    const amounts = txn.transactionAmounts ?? {}
    const code = secVal(amounts.transactionAcquiredDisposedCode) ?? ''
    // Map A/D codes into unified transaction code — use the 1-char code as-is;
    // actual letter code (P, S, etc.) may come from transactionCoding.transactionCode
    const codingCode = secVal(txn.transactionCoding?.transactionCode) ?? code
    const shares = parseDecimal(amounts.transactionShares) ?? 0
    const price = parseDecimal(amounts.transactionPricePerShare)
    const totalValue = price != null ? shares * price : null
    const sharesAfter = parseDecimal(
      txn.postTransactionAmounts?.sharesOwnedFollowingTransaction,
    )
    const ownershipForm =
      secVal(txn.ownershipNature?.directOrIndirectOwnership) ?? 'D'

    // Footnotes: may be a string ID referencing a footnote table
    let footnote: string | null = null
    if (txn.footnotes?.footnoteId) {
      const fn = txn.footnotes.footnoteId
      footnote = Array.isArray(fn)
        ? fn.map((f: unknown) => (typeof f === 'object' && f !== null && '@_id' in f ? (f as Record<string, string>)['@_id'] : String(f))).join(', ')
        : typeof fn === 'object' && fn !== null && '@_id' in fn
        ? (fn as Record<string, string>)['@_id']
        : String(fn)
    }

    return {
      transactionDate: txnDate,
      securityTitle: secTitle,
      transactionCode: codingCode || 'P',
      shares,
      pricePerShare: price,
      totalValue,
      sharesOwnedAfter: sharesAfter,
      ownershipForm,
      footnote,
      isDerivative: false,
    }
  } catch {
    return null
  }
}

function extractDerivative(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txn: any,
): Form4Transaction | null {
  try {
    const secTitle = secVal(txn.securityTitle) ?? 'Unknown Derivative'
    const txnDate = parseDate(txn.transactionDate)
    const amounts = txn.transactionAmounts ?? {}
    const code = secVal(amounts.transactionAcquiredDisposedCode) ?? ''
    const codingCode = secVal(txn.transactionCoding?.transactionCode) ?? code
    const shares = parseDecimal(amounts.transactionShares) ?? 0
    const price = parseDecimal(amounts.transactionPricePerShare)
    const totalValue = price != null ? shares * price : null
    const sharesAfter = parseDecimal(
      txn.postTransactionAmounts?.sharesOwnedFollowingTransaction,
    )
    const ownershipForm =
      secVal(txn.ownershipNature?.directOrIndirectOwnership) ?? 'D'

    let footnote: string | null = null
    if (txn.footnotes?.footnoteId) {
      const fn = txn.footnotes.footnoteId
      footnote = Array.isArray(fn)
        ? fn.map((f: unknown) => (typeof f === 'object' && f !== null && '@_id' in f ? (f as Record<string, string>)['@_id'] : String(f))).join(', ')
        : typeof fn === 'object' && fn !== null && '@_id' in fn
        ? (fn as Record<string, string>)['@_id']
        : String(fn)
    }

    return {
      transactionDate: txnDate,
      securityTitle: secTitle,
      transactionCode: codingCode || 'M',
      shares,
      pricePerShare: price,
      totalValue,
      sharesOwnedAfter: sharesAfter,
      ownershipForm,
      footnote,
      isDerivative: true,
    }
  } catch {
    return null
  }
}

export function parseForm4(xml: string): ParsedForm4 {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = parser.parse(xml)
  const root = doc?.ownershipDocument ?? {}

  const issuer = root.issuer ?? {}
  const issuerCik = secVal(issuer.issuerCik)
  const issuerName = secVal(issuer.issuerName)
  const issuerTicker = secVal(issuer.issuerTradingSymbol)

  // reportingOwner can be an array (multiple owners) or a single object
  const ownerRaw = root.reportingOwner
  const firstOwner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw
  const reportingOwnerCik =
    secVal(firstOwner?.reportingOwnerId?.rptOwnerCik) ?? null

  const transactions: Form4Transaction[] = []

  // Non-derivative transactions
  const nonDerivTable = root.nonDerivativeTable
  if (nonDerivTable) {
    const rawTxns = nonDerivTable.nonDerivativeTransaction
    const txnArray = Array.isArray(rawTxns)
      ? rawTxns
      : rawTxns != null
      ? [rawTxns]
      : []
    for (const txn of txnArray) {
      const parsed = extractNonDerivative(txn)
      if (parsed) transactions.push(parsed)
    }
  }

  // Derivative transactions
  const derivTable = root.derivativeTable
  if (derivTable) {
    const rawTxns = derivTable.derivativeTransaction
    const txnArray = Array.isArray(rawTxns)
      ? rawTxns
      : rawTxns != null
      ? [rawTxns]
      : []
    for (const txn of txnArray) {
      const parsed = extractDerivative(txn)
      if (parsed) transactions.push(parsed)
    }
  }

  return {
    issuerCik,
    issuerName,
    issuerTicker,
    reportingOwnerCik,
    transactions,
  }
}

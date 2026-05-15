import { XMLParser } from 'fast-xml-parser'

export interface Form13FHolding {
  nameOfIssuer: string
  titleOfClass: string
  cusip: string
  /** Value in dollars (already multiplied from thousands) */
  value: number | null
  shares: number
  sshPrnamtType: string
  investmentDiscretion: string
  /** Derived: value / shares (approximate price per share) */
  pricePerShare: number | null
}

export interface ParsedForm13F {
  reportingPeriod: Date | null
  holdings: Form13FHolding[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'infoTable',
  // 13F XML sometimes wraps values in CDATA or has namespaces
  removeNSPrefix: true,
  cdataPropName: '__cdata',
})

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = parseFloat(String(v))
  return isNaN(n) ? null : n
}

function toStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

export function parseForm13F(xml: string): ParsedForm13F {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = parser.parse(xml)

  // The 13F-HR XML has two possible root structures:
  // 1. <edgarSubmission> wrapping <informationTable>
  // 2. Just <informationTable> at root
  // Some filings separate primary doc (cover) and infoTable doc; we handle both.
  let infoTables: unknown[] = []

  const findInfoTable = (node: unknown): unknown[] => {
    if (node == null || typeof node !== 'object') return []
    const obj = node as Record<string, unknown>
    if (Array.isArray(obj['infoTable'])) {
      return obj['infoTable'] as unknown[]
    }
    for (const key of Object.keys(obj)) {
      const result = findInfoTable(obj[key])
      if (result.length > 0) return result
    }
    return []
  }

  infoTables = findInfoTable(doc)

  const holdings: Form13FHolding[] = infoTables.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const shares = toNum(r.shrsOrPrnAmt?.sshPrnamt) ?? 0
    // value field is in thousands of dollars
    const valueThousands = toNum(r.value)
    const valueDollars = valueThousands != null ? valueThousands * 1000 : null
    const pricePerShare =
      valueDollars != null && shares > 0
        ? parseFloat((valueDollars / shares).toFixed(6))
        : null

    return {
      nameOfIssuer: toStr(r.nameOfIssuer),
      titleOfClass: toStr(r.titleOfClass),
      cusip: toStr(r.cusip),
      value: valueDollars,
      shares,
      sshPrnamtType: toStr(r.shrsOrPrnAmt?.sshPrnamtType) || 'SH',
      investmentDiscretion: toStr(r.investmentDiscretion) || 'SOLE',
      pricePerShare,
    }
  })

  return {
    reportingPeriod: null, // period comes from filing metadata, not the infoTable XML
    holdings,
  }
}

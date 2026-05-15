export interface Schedule13DGResult {
  subjectCompanyName: string | null
  subjectCompanyCik: string | null
  ownershipPercentage: number | null
  formType: '13D' | '13G'
}

export interface ParsedSchedule13DG {
  result: Schedule13DGResult
  /**
   * A single "transaction" representing the ownership stake.
   * shares = ownershipPercentage as a decimal (e.g., 0.0512 for 5.12%)
   * transactionCode = '13D' or '13G'
   */
  transaction: {
    transactionDate: Date
    securityTitle: string
    transactionCode: string
    shares: number
    pricePerShare: null
    totalValue: null
    sharesOwnedAfter: null
    ownershipForm: string
    footnote: string | null
  }
}

/**
 * Extract ownership percentage from SEC Schedule 13D/G text or HTML.
 * Looks for patterns like "5.12% of the outstanding" or "represents 7.5% of"
 */
function extractOwnershipPercentage(text: string): number | null {
  // Primary pattern from spec
  const primary = /([\d.]+)%\s*of\s*(the\s*)?outstanding/i.exec(text)
  if (primary) {
    const n = parseFloat(primary[1])
    return isNaN(n) ? null : n
  }

  // Fallback patterns
  const fallbacks = [
    /represents\s+([\d.]+)%/i,
    /aggregate\s+of\s+([\d.]+)%/i,
    /beneficially\s+owns?\s+([\d.]+)%/i,
    /([\d.]+)%\s+of\s+(?:the\s+)?(?:issued\s+and\s+)?outstanding/i,
    /percentage\s+of\s+class[^:]*:\s*([\d.]+)%/i,
    // Row 11 / Item 11 in 13D/G cover page
    /(?:item|row)\s+11[^:\n]*[:\s]+([\d.]+)%/i,
  ]
  for (const re of fallbacks) {
    const m = re.exec(text)
    if (m) {
      const n = parseFloat(m[1])
      if (!isNaN(n)) return n
    }
  }
  return null
}

/**
 * Extract subject company name from SEC filing HTML/text.
 * The cover page typically has "Name of Issuer" or "Name of Subject Company"
 */
function extractSubjectCompanyName(text: string): string | null {
  const patterns = [
    /name\s+of\s+(?:the\s+)?(?:issuer|subject\s+company)[^:]*:\s*([^\n<]+)/i,
    /subject\s+company[^:]*:\s*([^\n<]+)/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return m[1].trim().replace(/<[^>]+>/g, '').trim()
  }
  return null
}

/**
 * Extract subject company CIK from SEC filing HTML/text.
 */
function extractSubjectCompanyCik(text: string): string | null {
  // CIK typically appears near the company name on the cover page
  const patterns = [
    /(?:central\s+index\s+key|cik)[^:]*:\s*(\d{1,10})/i,
    /cik\s+#?\s*(\d{1,10})/i,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return m[1].padStart(10, '0')
  }
  return null
}

/**
 * Strip HTML tags to get plain text for easier regex matching.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
}

export function parseSchedule13DG(
  html: string,
  formType: '13D' | '13G',
): ParsedSchedule13DG {
  const text = html.includes('<') ? stripHtml(html) : html

  const ownershipPercentage = extractOwnershipPercentage(text)
  const subjectCompanyName = extractSubjectCompanyName(text)
  const subjectCompanyCik = extractSubjectCompanyCik(text)

  // Express percentage as a decimal fraction for the shares field
  // e.g. 5.12% → 0.0512
  const sharesDecimal =
    ownershipPercentage != null ? parseFloat((ownershipPercentage / 100).toFixed(6)) : 0

  return {
    result: {
      subjectCompanyName,
      subjectCompanyCik,
      ownershipPercentage,
      formType,
    },
    transaction: {
      transactionDate: new Date(),
      securityTitle: subjectCompanyName
        ? `${formType} filing – ${subjectCompanyName}`
        : `Schedule ${formType} Ownership`,
      transactionCode: formType === '13D' ? '13D' : '13G',
      shares: sharesDecimal,
      pricePerShare: null,
      totalValue: null,
      sharesOwnedAfter: null,
      ownershipForm: 'I', // typically indirect/beneficial ownership
      footnote:
        ownershipPercentage != null
          ? `Reported ownership: ${ownershipPercentage}% of outstanding shares`
          : null,
    },
  }
}

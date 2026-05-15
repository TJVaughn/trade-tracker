import axios, { AxiosInstance } from 'axios'

export interface SubmissionsRecentFilings {
  accessionNumber: string[]
  filingDate: string[]
  form: string[]
  primaryDocument: string[]
  reportDate: string[]
}

export interface SubmissionsResponse {
  cik: string
  name: string
  filings: {
    recent: SubmissionsRecentFilings
  }
}

export interface EftsHit {
  _id: string
  _source: {
    period_of_report: string
    entity_name: string
    file_num: string
    form_type: string
    biz_location: string
    inc_states: string
    file_date: string
    period_date?: string
    entity_id: string
  }
}

interface EftsSearchResponse {
  hits: {
    hits: EftsHit[]
    total: { value: number; relation: string }
  }
}

function getEdgarUserAgent(): string {
  const userAgent = process.env.EDGAR_USER_AGENT?.trim()
  if (!userAgent) {
    throw new Error(
      'EDGAR_USER_AGENT is required and must include an app name plus contact email',
    )
  }
  return userAgent
}
// SEC allows up to 10 req/sec; we use a 150ms floor between requests to stay safe
const MIN_REQUEST_INTERVAL_MS = 150

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class EdgarClient {
  private readonly dataClient: AxiosInstance
  private readonly archiveClient: AxiosInstance
  private readonly eftsClient: AxiosInstance
  private lastRequestTime = 0

  constructor() {
    const commonHeaders = {
      'User-Agent': getEdgarUserAgent(),
      Accept: 'application/json',
    }

    this.dataClient = axios.create({
      baseURL: 'https://data.sec.gov',
      headers: commonHeaders,
      timeout: 30_000,
    })

    this.archiveClient = axios.create({
      baseURL: 'https://www.sec.gov',
      headers: { ...commonHeaders, Accept: 'text/xml,application/xml,text/html,*/*' },
      timeout: 30_000,
    })

    this.eftsClient = axios.create({
      baseURL: 'https://efts.sec.gov',
      headers: commonHeaders,
      timeout: 30_000,
    })
  }

  /** Zero-pad a CIK to 10 digits */
  padCik(cik: string): string {
    // Strip any leading zeros first, then re-pad to avoid double-padding
    const numeric = cik.replace(/^0+/, '') || '0'
    return numeric.padStart(10, '0')
  }

  /** Remove dashes from an accession number: "0000315090-24-000001" → "000031509024000001" */
  normalizeAccession(accessionNumber: string): string {
    return accessionNumber.replace(/-/g, '')
  }

  /** Enforce rate limiting: wait until at least MIN_REQUEST_INTERVAL_MS has passed since the last request */
  private async throttle(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - elapsed)
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Fetch the submissions JSON for a CIK.
   * https://data.sec.gov/submissions/CIK{10-digit-zero-padded-cik}.json
   */
  async getSubmissions(cik: string): Promise<SubmissionsResponse> {
    await this.throttle()
    const padded = this.padCik(cik)
    const response = await this.dataClient.get<SubmissionsResponse>(
      `/submissions/CIK${padded}.json`,
    )
    return response.data
  }

  /**
   * Fetch the raw XML (or HTML) content of a filing document.
   * https://www.sec.gov/Archives/edgar/data/{cik}/{accession-no-dashes}/{primaryDocument}
   */
  async getFilingDocument(
    cik: string,
    accessionNumber: string,
    primaryDocument: string,
  ): Promise<string> {
    await this.throttle()
    const numericCik = cik.replace(/^0+/, '') || '0'
    const normalizedAccession = this.normalizeAccession(accessionNumber)
    const url = `/Archives/edgar/data/${numericCik}/${normalizedAccession}/${primaryDocument}`
    const response = await this.archiveClient.get<string>(url, {
      responseType: 'text',
    })
    return response.data
  }

  /**
   * Search EFTS for recent filings by form type.
   * https://efts.sec.gov/LATEST/search-index?q=&forms=4&dateRange=custom&startdt=...&enddt=...
   */
  async searchFilings(formTypes: string[], startDate: Date): Promise<EftsHit[]> {
    await this.throttle()
    const endDate = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const formsParam = formTypes.map(encodeURIComponent).join(',')
    const url = `/LATEST/search-index?q=&forms=${formsParam}&dateRange=custom&startdt=${fmt(startDate)}&enddt=${fmt(endDate)}`

    const response = await this.eftsClient.get<EftsSearchResponse>(url)
    return response.data?.hits?.hits ?? []
  }
}

export const edgarClient = new EdgarClient()

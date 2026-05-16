import { prisma, Entity, FormType } from '@trade-tracker/db'
import { edgarClient } from './edgar/client'
import { parseForm4 } from './edgar/parsers/form4'
import { parseForm13F } from './edgar/parsers/form13f'
import { parseSchedule13DG } from './edgar/parsers/schedule13dg'
import { notifyNewFiling, FilingWithEntity } from './notifications'

/** How far back to look on the very first run (no PollerState yet) */
const INITIAL_LOOKBACK_DAYS = 30

/** Map raw EDGAR form strings to our FormType enum */
function mapFormType(form: string): FormType | null {
  const normalized = form.trim().toUpperCase()
  if (normalized === '4') return FormType.FORM_4
  if (normalized === '13F-HR' || normalized === '13F-HT' || normalized === '13F')
    return FormType.FORM_13F
  if (
    normalized === 'SC 13D' ||
    normalized === 'SC 13D/A' ||
    normalized === 'SC 13G' ||
    normalized === 'SC 13G/A'
  )
    return FormType.SCHEDULE_13DG
  return null
}

function is13DVariant(form: string): boolean {
  return form.toUpperCase().includes('13D')
}

function cutoffDate(lastSeenAt: Date | null): Date {
  if (lastSeenAt) return lastSeenAt
  const d = new Date()
  d.setDate(d.getDate() - INITIAL_LOOKBACK_DAYS)
  return d
}

export async function pollEntity(entity: Entity): Promise<void> {
  console.log(`[poller] Polling entity: ${entity.name} (CIK: ${entity.cik})`)

  // Load the current PollerState for each relevant form type so we know
  // the cutoff date. We do this once per entity poll invocation.
  const pollerStates = await prisma.pollerState.findMany({
    where: {
      formType: {
        in: [FormType.FORM_4, FormType.FORM_13F, FormType.SCHEDULE_13DG],
      },
    },
  })
  const stateByFormType = new Map(pollerStates.map((s) => [s.formType, s]))

  // Fetch submissions from EDGAR
  let submissions
  try {
    submissions = await edgarClient.getSubmissions(entity.cik)
  } catch (err) {
    console.error(`[poller] Failed to fetch submissions for ${entity.name}:`, err)
    return
  }

  const recent = submissions.filings.recent
  const count = recent.accessionNumber.length

  // Track whether we wrote any new processed filings per form type
  // so we can update PollerState.lastSeenAt at the end.
  const latestFiledAtByFormType = new Map<FormType, Date>()

  for (let i = 0; i < count; i++) {
    const rawForm = recent.form[i]
    const formType = mapFormType(rawForm)
    if (!formType) continue

    const filedDateStr = recent.filingDate[i]
    const filedAt = new Date(filedDateStr + 'T00:00:00.000Z')

    // Apply cutoff
    const state = stateByFormType.get(formType) ?? null
    const cutoff = cutoffDate(state?.lastSeenAt ?? null)
    if (filedAt < cutoff) continue

    const accessionNumber = recent.accessionNumber[i]
    const primaryDocumentRaw = recent.primaryDocument[i]
    // EDGAR submissions sometimes returns "xslF345X06/form4.xml" or
    // "xslForm13F_X02/primary_doc.xml" — fetching that path returns a rendered
    // HTML view rather than raw XML. Strip the leading xsl*/ directory so we
    // always fetch the raw XML file.
    const primaryDocument = primaryDocumentRaw.replace(/^xsl[^/]+\//i, '')
    const reportDateStr = recent.reportDate[i]
    const periodOfReport = reportDateStr
      ? new Date(reportDateStr + 'T00:00:00.000Z')
      : null

    // Check if already in DB
    const existing = await prisma.filing.findUnique({
      where: { accessionNumber },
    })
    if (existing) continue

    // Derive the filing document URL for logging
    const numericCik = entity.cik.replace(/^0+/, '') || '0'
    const normalizedAccession = edgarClient.normalizeAccession(accessionNumber)
    const rawUrl = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${normalizedAccession}/${primaryDocument}`

    // Create the Filing record (unprocessed) so we have an ID to hang
    // transactions on and so we don't re-fetch on retry crashes.
    const filing = await prisma.filing.create({
      data: {
        accessionNumber,
        formType,
        filedAt,
        periodOfReport,
        entityId: entity.id,
        rawUrl,
        processed: false,
      },
    })

    // For 13F filings the primaryDocument is the cover sheet; the actual holdings
    // live in a separate INFORMATION TABLE document in the same accession.
    let fetchDocument = primaryDocument
    if (formType === FormType.FORM_13F) {
      try {
        const infoTableFilename = await edgarClient.getInfoTableFilename(
          entity.cik,
          accessionNumber,
        )
        if (infoTableFilename) {
          fetchDocument = infoTableFilename
        } else {
          console.warn(`[poller] No info table found for 13F ${accessionNumber}, falling back to primary doc`)
        }
      } catch (err) {
        console.warn(`[poller] Could not fetch index for ${accessionNumber}:`, err instanceof Error ? err.message : err)
      }
    }

    // Fetch the document
    let rawDoc: string
    try {
      rawDoc = await edgarClient.getFilingDocument(
        entity.cik,
        accessionNumber,
        fetchDocument,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[poller] Failed to fetch document ${rawUrl}:`, msg)
      await prisma.filing.update({
        where: { id: filing.id },
        data: { processingError: `fetch error: ${msg}` },
      })
      continue
    }

    // Parse the document and persist transactions
    try {
      if (formType === FormType.FORM_4) {
        const parsed = parseForm4(rawDoc)

        // Update filing with issuer info
        await prisma.filing.update({
          where: { id: filing.id },
          data: {
            issuerCik: parsed.issuerCik,
            issuerName: parsed.issuerName,
            issuerTicker: parsed.issuerTicker,
          },
        })

        for (const txn of parsed.transactions) {
          await prisma.transaction.create({
            data: {
              filingId: filing.id,
              transactionDate: txn.transactionDate,
              securityTitle: txn.securityTitle,
              transactionCode: txn.transactionCode,
              shares: txn.shares,
              pricePerShare: txn.pricePerShare,
              totalValue: txn.totalValue,
              sharesOwnedAfter: txn.sharesOwnedAfter,
              ownershipForm: txn.ownershipForm,
              footnote: txn.footnote,
            },
          })
        }
      } else if (formType === FormType.FORM_13F) {
        const parsed = parseForm13F(rawDoc)

        for (const holding of parsed.holdings) {
          await prisma.transaction.create({
            data: {
              filingId: filing.id,
              transactionDate: periodOfReport ?? filedAt,
              securityTitle: `${holding.nameOfIssuer} (${holding.titleOfClass})`,
              transactionCode: '13F',
              shares: holding.shares,
              pricePerShare: holding.pricePerShare,
              totalValue: holding.value,
              sharesOwnedAfter: null,
              ownershipForm: holding.investmentDiscretion,
              footnote: holding.cusip ? `CUSIP: ${holding.cusip}` : null,
            },
          })
        }
      } else if (formType === FormType.SCHEDULE_13DG) {
        const subType = is13DVariant(rawForm) ? '13D' : '13G'
        const parsed = parseSchedule13DG(rawDoc, subType)

        // Update filing with subject company info
        if (parsed.result.subjectCompanyName || parsed.result.subjectCompanyCik) {
          await prisma.filing.update({
            where: { id: filing.id },
            data: {
              issuerName: parsed.result.subjectCompanyName,
              issuerCik: parsed.result.subjectCompanyCik,
            },
          })
        }

        const txn = parsed.transaction
        await prisma.transaction.create({
          data: {
            filingId: filing.id,
            transactionDate: txn.transactionDate,
            securityTitle: txn.securityTitle,
            transactionCode: txn.transactionCode,
            shares: txn.shares,
            pricePerShare: null,
            totalValue: null,
            sharesOwnedAfter: null,
            ownershipForm: txn.ownershipForm,
            footnote: txn.footnote,
          },
        })
      }

      // Mark filing as processed
      await prisma.filing.update({
        where: { id: filing.id },
        data: { processed: true },
      })

      // Track the most recent filedAt per form type for PollerState update
      const existing = latestFiledAtByFormType.get(formType)
      if (!existing || filedAt > existing) {
        latestFiledAtByFormType.set(formType, filedAt)
      }

      // Build a full FilingWithEntity for notifications
      const filingWithEntity: FilingWithEntity = {
        id: filing.id,
        accessionNumber: filing.accessionNumber,
        formType: filing.formType,
        filedAt: filing.filedAt,
        issuerName: filing.issuerName,
        issuerTicker: filing.issuerTicker,
        entity: {
          id: entity.id,
          name: entity.name,
          cik: entity.cik,
        },
        transactions: await prisma.transaction.findMany({
          where: { filingId: filing.id },
        }),
      }

      // Fire-and-forget notifications; errors are logged inside notifyNewFiling
      notifyNewFiling(filingWithEntity).catch((err) =>
        console.error(`[poller] Notification error for filing ${filing.id}:`, err),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[poller] Failed to parse/store filing ${accessionNumber}:`,
        msg,
      )
      await prisma.filing.update({
        where: { id: filing.id },
        data: { processingError: `parse error: ${msg}` },
      })
    }
  }

  // Update PollerState.lastChecked (and lastSeenAt if we saw new filings)
  for (const ft of [FormType.FORM_4, FormType.FORM_13F, FormType.SCHEDULE_13DG]) {
    const latestSeen = latestFiledAtByFormType.get(ft)
    await prisma.pollerState.upsert({
      where: { formType: ft },
      update: {
        lastChecked: new Date(),
        ...(latestSeen ? { lastSeenAt: latestSeen } : {}),
      },
      create: {
        formType: ft,
        lastChecked: new Date(),
        lastSeenAt: latestSeen ?? null,
      },
    })
  }

  console.log(`[poller] Done polling ${entity.name}`)
}

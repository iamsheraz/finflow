/**
 * Client-side PDF statement parser using pdf.js.
 * Extracts text from PDF pages, then parses transaction rows.
 *
 * Handles common bank statement formats:
 * - Chase, Amex, Citi, Bank of America, Capital One, etc.
 * - Looks for date + description + amount patterns per line
 */

import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/**
 * Extract all text content from a PDF file.
 */
async function extractText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    pages.push(text)
  }

  return {
    fullText: pages.join('\n\n'),
    pages,
    pageCount: pdf.numPages,
  }
}

// Date patterns: MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, Month DD, YYYY
const DATE_PATTERNS = [
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /(\d{1,2}-\d{1,2}-\d{2,4})/,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?)/i,
]

// Amount pattern: $1,234.56 or 1234.56 or -$1,234.56
const AMOUNT_PATTERN = /-?\$?[\d,]+\.\d{2}/g

// Bank detection from PDF text
const BANK_DETECTORS = [
  { pattern: /chase/i, bank: 'Chase' },
  { pattern: /american express|amex/i, bank: 'American Express' },
  { pattern: /citi(?:bank|card)/i, bank: 'Citi' },
  { pattern: /bank of america/i, bank: 'Bank of America' },
  { pattern: /capital one/i, bank: 'Capital One' },
  { pattern: /discover/i, bank: 'Discover' },
  { pattern: /wells fargo/i, bank: 'Wells Fargo' },
  { pattern: /barclays/i, bank: 'Barclays' },
  { pattern: /usaa/i, bank: 'USAA' },
]

function detectBank(text) {
  for (const { pattern, bank } of BANK_DETECTORS) {
    if (pattern.test(text)) return bank
  }
  return null
}

function detectAccountType(text) {
  if (/credit\s*card|card\s*member|statement\s*balance|minimum\s*payment|credit\s*limit/i.test(text)) {
    return 'credit'
  }
  if (/checking|savings|deposit|withdrawal/i.test(text)) {
    return 'debit'
  }
  return 'credit' // Default to credit for card statements
}

function detectLast4(text) {
  const match = text.match(/(?:account|card|acct).*?(?:\*{3,}|x{3,}|ending\s*in\s*)(\d{4})/i)
    || text.match(/\*{3,}(\d{4})/i)
  return match ? match[1] : null
}

function detectStatementPeriod(text) {
  // Look for statement period patterns
  const periodMatch = text.match(
    /(?:statement\s*period|billing\s*period|period\s*ending|through|thru)\s*:?\s*.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  )
  if (periodMatch) {
    const d = new Date(periodMatch[1])
    if (!isNaN(d.getTime())) {
      return { month: d.getMonth() + 1, year: d.getFullYear() }
    }
  }

  // Fall back to finding the most common month in dates
  const dates = []
  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, 'gi')
    let match
    while ((match = regex.exec(text)) !== null) {
      const d = new Date(match[1])
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
        dates.push(d)
      }
    }
  }

  if (dates.length > 0) {
    const monthCounts = {}
    for (const d of dates) {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      monthCounts[key] = (monthCounts[key] || 0) + 1
    }
    const best = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]
    if (best) {
      const [y, m] = best[0].split('-').map(Number)
      return { month: m, year: y }
    }
  }

  return { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
}

/**
 * Parse transaction lines from extracted text.
 * Strategy: split into lines, find lines that have a date + amount pattern.
 */
function parseTransactionLines(fullText) {
  // Split on newlines and also on double spaces (common in PDF text extraction)
  const rawLines = fullText.split(/\n/)
  const transactions = []

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue

    // Find a date in the line
    let dateStr = null
    let dateObj = null
    for (const pattern of DATE_PATTERNS) {
      const match = trimmed.match(pattern)
      if (match) {
        const d = new Date(match[1])
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
          dateStr = match[1]
          dateObj = d
          break
        }
      }
    }

    if (!dateObj) continue

    // Find amounts in the line
    const amounts = []
    let amountMatch
    const amountRegex = new RegExp(AMOUNT_PATTERN.source, 'g')
    while ((amountMatch = amountRegex.exec(trimmed)) !== null) {
      const val = parseFloat(amountMatch[0].replace(/[$,]/g, ''))
      if (!isNaN(val) && Math.abs(val) > 0 && Math.abs(val) < 100000) {
        amounts.push(val)
      }
    }

    if (amounts.length === 0) continue

    // The amount is typically the last number on the line
    const amount = amounts[amounts.length - 1]

    // Extract description: everything between date and amount
    let description = trimmed
    // Remove the date
    if (dateStr) description = description.replace(dateStr, '')
    // Remove amounts
    for (const a of amounts) {
      const formatted = a.toFixed(2)
      description = description.replace(new RegExp(`-?\\$?${formatted.replace('.', '\\.')}`, 'g'), '')
    }
    description = description.replace(/\s{2,}/g, ' ').trim()

    // Skip header-like lines
    if (/^(date|description|amount|balance|total|subtotal)/i.test(description)) continue
    if (description.length < 3) continue

    transactions.push({
      date: dateObj.toISOString(),
      description,
      merchant: extractMerchant(description),
      amount: Math.abs(amount),
      direction: amount < 0 ? 'credit' : 'debit', // In statements, negative often means credit/refund
      category: null,
      isTransfer: false,
      isIncome: false,
      isRecurring: false,
    })
  }

  return transactions
}

function extractMerchant(description) {
  return description
    .replace(/#\d+/g, '')
    .replace(/\s+\d{4,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Main entry point: parse a PDF file into transactions + account info.
 */
export async function parsePDF(file) {
  const { fullText, pageCount } = await extractText(file)

  if (fullText.trim().length < 50) {
    throw new Error('Could not extract text from PDF. It may be a scanned document (OCR not yet supported).')
  }

  const bank = detectBank(fullText)
  const accountType = detectAccountType(fullText)
  const last4 = detectLast4(fullText)
  const period = detectStatementPeriod(fullText)

  const transactions = parseTransactionLines(fullText)

  if (transactions.length === 0) {
    throw new Error('No transactions found in PDF. The format may not be supported yet.')
  }

  return {
    transactions,
    accountInfo: {
      type: accountType,
      bank,
      last4,
    },
    statementInfo: {
      month: period.month,
      year: period.year,
      transactionCount: transactions.length,
      pageCount,
    },
  }
}

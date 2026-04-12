/**
 * PDF statement parser.
 *
 * Strategy:
 * 1. Extract raw text from PDF using pdf.js (client-side)
 * 2. Detect bank, account type, last4, statement period from header text (regex)
 * 3. Send text to Claude API to extract structured transactions (any bank format)
 * 4. Fallback to regex parser if Claude API is unavailable
 */

import * as pdfjsLib from 'pdfjs-dist'
import { callClaude } from './claudeApi'

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

// ─── Bank / Account detection (regex — works fine for headers) ───

const BANK_DETECTORS = [
  { pattern: /bank of america/i, bank: 'Bank of America' },
  { pattern: /capital one/i, bank: 'Capital One' },
  { pattern: /american express|amex/i, bank: 'American Express' },
  { pattern: /wells fargo/i, bank: 'Wells Fargo' },
  { pattern: /citi(?:bank|card)/i, bank: 'Citi' },
  { pattern: /jpmorgan chase|chase bank|chase\.com|chase credit/i, bank: 'Chase' },
  { pattern: /discover(?:\s+bank|\s+card|\s+financial)/i, bank: 'Discover' },
  { pattern: /barclays/i, bank: 'Barclays' },
  { pattern: /usaa/i, bank: 'USAA' },
]

function detectBank(text) {
  const headerText = text.slice(0, Math.max(500, Math.floor(text.length * 0.2)))
  for (const { pattern, bank } of BANK_DETECTORS) {
    if (pattern.test(headerText)) return bank
  }
  for (const { pattern, bank } of BANK_DETECTORS) {
    if (pattern.test(text)) return bank
  }
  return null
}

function detectAccountType(text) {
  if (/credit\s*card|card\s*member|statement\s*balance|minimum\s*payment|credit\s*limit/i.test(text)) {
    return 'credit'
  }
  if (/checking|savings|deposit|withdrawal|debit\s*card/i.test(text)) {
    return 'debit'
  }
  return 'credit'
}

function detectLast4(text) {
  const match = text.match(/(?:account|card|acct).*?(?:\*{3,}|x{3,}|ending\s*in\s*)(\d{4})/i)
    || text.match(/\*{3,}(\d{4})/i)
    || text.match(/account\s*(?:number|#)?:?\s*(?:\d{4}\s*){0,3}(\d{4})\b/i)
  return match ? match[1] : null
}

function detectStatementPeriod(text) {
  // Statement period pattern
  const periodMatch = text.match(
    /(?:statement\s*period|billing\s*period|period\s*ending|through|thru|for)\s*:?\s*.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  )
  if (periodMatch) {
    const d = new Date(periodMatch[1])
    if (!isNaN(d.getTime())) {
      return { month: d.getMonth() + 1, year: d.getFullYear() }
    }
  }

  // BoA style: "for January 8, 2026 to February 4, 2026"
  const boaMatch = text.match(
    /for\s+\w+\s+\d{1,2},?\s+(\d{4})\s+to\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i
  )
  if (boaMatch) {
    const endDate = new Date(`${boaMatch[2]} ${boaMatch[3]}, ${boaMatch[4]}`)
    if (!isNaN(endDate.getTime())) {
      return { month: endDate.getMonth() + 1, year: endDate.getFullYear() }
    }
  }

  // Fallback: most common month in dates
  const DATE_PATTERNS = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    /(\d{1,2}-\d{1,2}-\d{2,4})/g,
  ]
  const dates = []
  for (const pattern of DATE_PATTERNS) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const d = new Date(match[1])
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) dates.push(d)
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

// ─── Claude-based transaction extraction ───

const EXTRACTION_PROMPT = `You are a bank statement parser. Extract ALL transactions from the following bank statement text.

RULES:
- Return ONLY a JSON array, no other text, no markdown code blocks
- Each transaction must have: { "date": "MM/DD/YYYY", "description": "string", "amount": number, "type": "debit" or "credit" }
- "debit" means money going OUT (purchases, payments, withdrawals, fees)
- "credit" means money coming IN (deposits, refunds, credits, incoming transfers)
- Use positive numbers for amounts (the "type" field indicates direction)
- Include EVERY individual transaction — do not summarize or group them
- Do NOT include summary lines (Previous Balance, New Balance, Total, etc.)
- Do NOT include legal text, disclaimers, or promotional content
- For merchant names, clean up the description (remove extra numbers, city/state codes if obvious)
- If you cannot find any transactions, return an empty array: []
- Parse dates carefully — use the statement year for dates that only show MM/DD`

async function extractTransactionsWithClaude(fullText) {
  // Truncate to ~12k chars to stay within token limits while keeping transaction data
  // Skip the first ~500 chars (header/address) and last ~2000 chars (legal/footer)
  const trimmedText = fullText.length > 14000
    ? fullText.slice(0, 14000)
    : fullText

  const response = await callClaude(EXTRACTION_PROMPT, trimmedText)

  // Parse JSON from response — handle markdown code blocks if Claude wraps it
  let jsonStr = response.trim()
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Could not parse transaction data from AI response')
  }

  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) {
    throw new Error('AI response was not an array of transactions')
  }

  // Convert to our transaction format
  return parsed
    .filter(t => t.date && t.description && t.amount != null)
    .map(t => {
      let dateObj
      // Handle MM/DD/YYYY, MM/DD/YY, or other formats
      try {
        dateObj = new Date(t.date)
        if (isNaN(dateObj.getTime())) {
          // Try parsing MM/DD/YYYY explicitly
          const [m, d, y] = t.date.split(/[\/\-]/).map(Number)
          dateObj = new Date(y < 100 ? 2000 + y : y, m - 1, d)
        }
      } catch {
        return null
      }

      if (!dateObj || isNaN(dateObj.getTime())) return null

      const amount = Math.abs(Number(t.amount))
      if (isNaN(amount) || amount === 0) return null

      return {
        date: dateObj.toISOString(),
        description: String(t.description).trim(),
        merchant: cleanMerchant(String(t.description)),
        amount,
        direction: t.type === 'credit' ? 'credit' : 'debit',
        category: null,
        isTransfer: false,
        isIncome: t.type === 'credit',
        isRecurring: false,
      }
    })
    .filter(Boolean)
}

function cleanMerchant(description) {
  return description
    .replace(/#\d+/g, '')
    .replace(/\s+\d{4,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ─── Regex fallback parser (for offline / API-unavailable scenarios) ───

const DATE_PATTERNS = [
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /(\d{1,2}-\d{1,2}-\d{2,4})/,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?)/i,
]

const AMOUNT_PATTERN = /-?\$?[\d,]+\.\d{2}/g

function splitIntoTransactionCandidates(fullText) {
  const rawLines = fullText.split(/\n/)
  const candidates = []

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue

    if (trimmed.length <= 250) {
      candidates.push(trimmed)
      continue
    }

    // Split long lines on date patterns (BoA-style PDFs)
    const parts = trimmed.split(/(?=\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s)/)
    for (const part of parts) {
      const p = part.trim()
      if (p && p.length >= 10 && p.length <= 300) {
        candidates.push(p)
      }
    }
  }

  return candidates
}

const SKIP_PATTERNS = [
  /^(date|description|amount|balance|total|subtotal|trans|merchant|debit|credit|post|posted|reference)/i,
  /\b(previous\s+balance|new\s+balance|minimum\s+payment|credit\s+limit|available\s+credit|payment\s+(made|received|due)|interest\s+(charged|paid)|annual\s+fee|balance\s+transfer|statement\s+balance|closing\s+balance|opening\s+balance|total\s+(charges|payments|credits|debits|fees))\b/i,
  /\b(terms?\s+and\s+conditions|interest\s+rates?|variable\s+rate|\bapr\b|\bapy\b|disclaimer|optional\s+feature|pay\s+over\s+time|rewards?\s+terms|cardmember\s+agreement|billing\s+rights|dispute|arbitration)\b/i,
  /^(page\s+\d|statement\s+(period|date|closing)|account\s+number|account\s+summary|member\s+since|card\s+number)/i,
  /\b(page\s+\d+\s+of\s+\d+|continued\s+on|continued\s+from|end\s+of\s+statement)\b/i,
  /^(important|please|see\s+|refer\s+|for\s+more|visit|call\s+|contact|www\.|http|email)/i,
  /\b(closing\s+date|statement\s+period|billing\s+period|payment\s+due\s+date|account\s+summary)\b/i,
]

function parseTransactionsRegex(fullText) {
  const candidates = splitIntoTransactionCandidates(fullText)
  const transactions = []

  for (const trimmed of candidates) {
    if (trimmed.length < 10) continue

    let skip = false
    for (const pattern of SKIP_PATTERNS) {
      if (pattern.test(trimmed)) { skip = true; break }
    }
    if (skip) continue

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
    if (amounts.length > 1 && /\s+to\s+\$?[\d,]+\.\d{2}/i.test(trimmed)) continue
    if (amounts.length > 1 && /\b(balance|total|subtotal|minimum|limit|fee|interest)\b/i.test(trimmed)) continue

    const amount = amounts[amounts.length - 1]

    let description = trimmed
    if (dateStr) description = description.replace(dateStr, '')
    for (const a of amounts) {
      const formatted = a.toFixed(2)
      description = description.replace(new RegExp(`-?\\$?${formatted.replace('.', '\\.')}`, 'g'), '')
    }
    description = description.replace(/\s{2,}/g, ' ').trim()

    if (description.length < 5) continue

    const descLower = description.toLowerCase()
    const legalKeywords = ['terms', 'rate', 'apr', 'apy', 'interest', 'legal', 'conditions', 'optional', 'promotion', 'available', 'your pay over time', 'cardmember', 'agreement', 'billing rights']
    const legalHits = legalKeywords.filter(kw => descLower.includes(kw)).length
    if (legalHits >= 2) continue

    const merchant = cleanMerchant(description)
    if (!merchant || merchant.length < 2) continue
    if (/\b(pay\s+over\s+time|interest\s+rate|terms\s+and\s+conditions|previous\s+balance|new\s+balance|minimum\s+payment|account\s+summary|important\s+information)\b/i.test(merchant)) continue

    transactions.push({
      date: dateObj.toISOString(),
      description,
      merchant,
      amount: Math.abs(amount),
      direction: amount < 0 ? 'credit' : 'debit',
      category: null,
      isTransfer: false,
      isIncome: false,
      isRecurring: false,
    })
  }

  return transactions
}

// ─── Main entry point ───

export async function parsePDF(file) {
  const { fullText, pageCount } = await extractText(file)

  if (fullText.trim().length < 50) {
    throw new Error('Could not extract text from PDF. It may be a scanned document (OCR not yet supported).')
  }

  const bank = detectBank(fullText)
  const accountType = detectAccountType(fullText)
  const last4 = detectLast4(fullText)
  const period = detectStatementPeriod(fullText)

  // Try Claude-based extraction first (best accuracy)
  let transactions = []
  try {
    transactions = await extractTransactionsWithClaude(fullText)
  } catch (err) {
    console.warn('[PDF Parser] Claude extraction failed, falling back to regex:', err.message)
  }

  // Fallback to regex parser if Claude fails or returns nothing
  if (transactions.length === 0) {
    transactions = parseTransactionsRegex(fullText)
  }

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

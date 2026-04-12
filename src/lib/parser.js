import Papa from 'papaparse'

/**
 * Common CSV column name mappings for various banks.
 * Each bank has different header names — we normalize them.
 */
const COLUMN_MAPPINGS = {
  date: ['date', 'trans date', 'transaction date', 'posting date', 'post date', 'trans. date'],
  description: ['description', 'merchant', 'name', 'memo', 'transaction description', 'details', 'payee'],
  amount: ['amount', 'transaction amount', 'trans amount'],
  debit: ['debit', 'debit amount', 'withdrawals', 'withdrawal'],
  credit: ['credit', 'credit amount', 'deposits', 'deposit'],
  type: ['type', 'transaction type', 'trans type'],
}

// Bank detection patterns from CSV headers or content
const BANK_PATTERNS = [
  { pattern: /chase/i, bank: 'Chase' },
  { pattern: /amex|american express/i, bank: 'American Express' },
  { pattern: /citi/i, bank: 'Citi' },
  { pattern: /bank of america|bofa/i, bank: 'Bank of America' },
  { pattern: /discover/i, bank: 'Discover' },
  { pattern: /capital one/i, bank: 'Capital One' },
  { pattern: /wells fargo/i, bank: 'Wells Fargo' },
  { pattern: /barclays/i, bank: 'Barclays' },
  { pattern: /usaa/i, bank: 'USAA' },
  { pattern: /paypal/i, bank: 'PayPal' },
]

function findColumn(headers, mappingKey) {
  const candidates = COLUMN_MAPPINGS[mappingKey]
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate)
    if (idx !== -1) return headers[idx]
  }
  return null
}

function detectAccountType(headers, rows) {
  const headerStr = headers.join(' ').toLowerCase()
  const firstRows = rows.slice(0, 5).map(r => Object.values(r).join(' ')).join(' ').toLowerCase()
  const combined = headerStr + ' ' + firstRows

  // A column named "Credit" or "Debit" is accounting terminology (debit/credit columns)
  // — NOT an indicator of credit card. Only match multi-word credit card phrases.
  const hasDebitCreditColumns = /\bdebit\b/.test(headerStr) && /\bcredit\b/.test(headerStr)

  // Check for PayPal
  if (/paypal/i.test(combined)) {
    return 'paypal'
  }
  // Check for explicit credit card indicators (multi-word, not just "credit")
  if (/credit\s*card|card\s*member|statement\s*balance|minimum\s*payment|credit\s*limit/i.test(combined)) {
    return 'credit'
  }
  // If the word "card" appears with a bank name but no debit/credit columns, likely credit
  if (!hasDebitCreditColumns && /\bcard\b/i.test(combined) && !/debit\s*card/i.test(combined)) {
    return 'credit'
  }
  return 'debit'
}

function detectBank(headers, rows) {
  const combined = headers.join(' ') + ' ' + rows.slice(0, 3).map(r => Object.values(r).join(' ')).join(' ')
  for (const { pattern, bank } of BANK_PATTERNS) {
    if (pattern.test(combined)) return bank
  }
  return null
}

function detectLast4(headers, rows) {
  const combined = headers.join(' ') + ' ' + rows.slice(0, 3).map(r => Object.values(r).join(' ')).join(' ')
  const match = combined.match(/(?:card|account|acct).*?(\d{4})/i) || combined.match(/\*{3,}(\d{4})/i)
  return match ? match[1] : null
}

function parseAmount(row, amountCol, debitCol, creditCol) {
  if (amountCol && row[amountCol] !== undefined && row[amountCol] !== '') {
    const val = parseFloat(String(row[amountCol]).replace(/[$,]/g, ''))
    if (!isNaN(val)) {
      return { amount: Math.abs(val), direction: val < 0 ? 'debit' : 'credit' }
    }
  }

  if (debitCol && row[debitCol] !== undefined && row[debitCol] !== '') {
    const val = parseFloat(String(row[debitCol]).replace(/[$,]/g, ''))
    if (!isNaN(val) && val !== 0) {
      return { amount: Math.abs(val), direction: 'debit' }
    }
  }

  if (creditCol && row[creditCol] !== undefined && row[creditCol] !== '') {
    const val = parseFloat(String(row[creditCol]).replace(/[$,]/g, ''))
    if (!isNaN(val) && val !== 0) {
      return { amount: Math.abs(val), direction: 'credit' }
    }
  }

  return null
}

export function parseCSV(fileContent) {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error('Failed to parse CSV: ' + results.errors[0].message))
          return
        }

        const headers = results.meta.fields || []
        const rows = results.data

        if (rows.length === 0) {
          reject(new Error('CSV file is empty'))
          return
        }

        // Find column mappings
        const dateCol = findColumn(headers, 'date')
        const descCol = findColumn(headers, 'description')
        const amountCol = findColumn(headers, 'amount')
        const debitCol = findColumn(headers, 'debit')
        const creditCol = findColumn(headers, 'credit')

        if (!dateCol) {
          reject(new Error('Could not find a date column in the CSV'))
          return
        }

        if (!descCol) {
          reject(new Error('Could not find a description/merchant column in the CSV'))
          return
        }

        if (!amountCol && !debitCol && !creditCol) {
          reject(new Error('Could not find an amount column in the CSV'))
          return
        }

        // Detect account info
        const accountType = detectAccountType(headers, rows)
        const bank = detectBank(headers, rows)
        const last4 = detectLast4(headers, rows)

        // For credit card CSVs, direction is inverted:
        // positive amounts = charges (debit/spending), negative = payments/credits
        // Only applies when using a single amount column (not split debit/credit columns)
        const isCreditCard = accountType === 'credit'
        const usingSingleAmountCol = !!amountCol && !debitCol && !creditCol

        // Parse transactions
        const transactions = []
        const months = new Set()

        for (const row of rows) {
          const dateStr = row[dateCol]
          if (!dateStr) continue

          const parsed = parseAmount(row, amountCol, debitCol, creditCol)
          if (!parsed) continue

          const date = new Date(dateStr)
          if (isNaN(date.getTime())) continue

          months.add(`${date.getFullYear()}-${date.getMonth() + 1}`)

          // Flip direction for credit card single-column CSVs
          let direction = parsed.direction
          if (isCreditCard && usingSingleAmountCol) {
            direction = direction === 'debit' ? 'credit' : 'debit'
          }

          transactions.push({
            date: date.toISOString(),
            description: row[descCol] || '',
            merchant: extractMerchant(row[descCol] || ''),
            amount: parsed.amount,
            direction,
            category: null,
            isTransfer: false,
            isIncome: false,
            isRecurring: false,
          })
        }

        // Detect month/year from most common month
        const monthCounts = {}
        for (const m of months) {
          monthCounts[m] = (monthCounts[m] || 0) + 1
        }
        const primaryMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]
        const [year, month] = primaryMonth ? primaryMonth[0].split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]

        resolve({
          transactions,
          accountInfo: {
            type: accountType,
            bank,
            last4,
          },
          statementInfo: {
            month,
            year,
            transactionCount: transactions.length,
          },
        })
      },
      error(err) {
        reject(err)
      },
    })
  })
}

function extractMerchant(description) {
  // Remove common suffixes like store numbers, locations
  return description
    .replace(/#\d+/g, '')
    .replace(/\s+\d{4,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

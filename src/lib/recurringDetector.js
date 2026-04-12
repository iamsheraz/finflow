/**
 * Detects recurring transactions (subscriptions, bills, etc.)
 * Looks for: same merchant, similar amount, monthly cadence.
 */

const AMOUNT_TOLERANCE = 0.10 // 10% variance allowed
const MIN_OCCURRENCES = 2    // Need at least 2 to detect pattern

/**
 * Group transactions by normalized merchant name, then check
 * for monthly cadence and similar amounts.
 */
export function detectRecurring(transactions) {
  // Only look at spending (debit, not transfers, not income)
  const spending = transactions.filter(
    t => t.direction === 'debit' && !t.isTransfer && !t.isIncome
  )

  // Group by normalized merchant
  const byMerchant = {}
  for (const t of spending) {
    const key = normalizeMerchant(t.merchant || t.description)
    if (!byMerchant[key]) byMerchant[key] = []
    byMerchant[key].push(t)
  }

  const recurring = []

  for (const [merchant, txns] of Object.entries(byMerchant)) {
    if (txns.length < MIN_OCCURRENCES) continue

    // Sort by date
    const sorted = txns.sort((a, b) => new Date(a.date) - new Date(b.date))

    // Check amount similarity
    const amounts = sorted.map(t => Math.abs(t.amount))
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const allSimilar = amounts.every(
      a => Math.abs(a - avgAmount) / avgAmount <= AMOUNT_TOLERANCE
    )

    if (!allSimilar) continue

    // Check monthly cadence (25-35 day intervals)
    const intervals = []
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / (1000 * 60 * 60 * 24)
      intervals.push(daysDiff)
    }

    const isMonthly = intervals.length > 0 && intervals.every(d => d >= 25 && d <= 38)

    if (!isMonthly && intervals.length > 0) {
      // Also check if it's roughly biweekly or weekly
      const isBiweekly = intervals.every(d => d >= 12 && d <= 18)
      const isWeekly = intervals.every(d => d >= 5 && d <= 10)
      if (!isBiweekly && !isWeekly) continue
    }

    // Determine frequency
    let frequency = 'monthly'
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length
      if (avgInterval < 10) frequency = 'weekly'
      else if (avgInterval < 18) frequency = 'biweekly'
      else frequency = 'monthly'
    }

    // Get the display merchant name from the most recent transaction
    const displayName = sorted[sorted.length - 1].merchant || sorted[sorted.length - 1].description
    const category = sorted[sorted.length - 1].category

    recurring.push({
      merchant: displayName,
      normalizedMerchant: merchant,
      frequency,
      avgAmount,
      lastAmount: amounts[amounts.length - 1],
      occurrences: sorted.length,
      ytdTotal: amounts.reduce((s, a) => s + a, 0),
      monthlyEstimate: frequency === 'weekly' ? avgAmount * 4.33 :
                       frequency === 'biweekly' ? avgAmount * 2.17 :
                       avgAmount,
      annualEstimate: frequency === 'weekly' ? avgAmount * 52 :
                      frequency === 'biweekly' ? avgAmount * 26 :
                      avgAmount * 12,
      lastDate: sorted[sorted.length - 1].date,
      firstDate: sorted[0].date,
      category,
      transactionIds: sorted.map(t => t.id),
    })
  }

  // Sort by monthly cost descending
  return recurring.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}

function normalizeMerchant(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[#\d]+/g, '')       // Remove numbers and #
    .replace(/\s+/g, ' ')         // Collapse whitespace
    .replace(/[^a-z\s]/g, '')     // Remove special chars
    .trim()
}

/**
 * Mark transactions as recurring in the database
 */
export function getRecurringTransactionIds(recurringItems) {
  const ids = new Set()
  for (const item of recurringItems) {
    for (const id of item.transactionIds) {
      ids.add(id)
    }
  }
  return ids
}

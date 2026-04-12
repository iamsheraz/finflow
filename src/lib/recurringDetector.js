/**
 * Smart recurring transaction detector.
 *
 * Improvements over naive approach:
 * - Majority-based cadence detection (not "every interval must match")
 * - Tolerates price changes, missed months, and date drift
 * - Known subscription/bill patterns get boosted detection
 * - Supports weekly, biweekly, monthly, and quarterly frequencies
 * - Better merchant normalization
 */

const MIN_OCCURRENCES = 2

// Cadence definitions: { name, minDays, maxDays, annualMultiplier, monthlyMultiplier }
const CADENCES = [
  { name: 'weekly',    minDays: 5,   maxDays: 10,  annual: 52,   monthly: 4.33 },
  { name: 'biweekly',  minDays: 12,  maxDays: 18,  annual: 26,   monthly: 2.17 },
  { name: 'monthly',   minDays: 25,  maxDays: 40,  annual: 12,   monthly: 1 },
  { name: 'quarterly', minDays: 80,  maxDays: 105, annual: 4,    monthly: 1 / 3 },
]

// Known subscription/bill merchant patterns — these get detected with relaxed thresholds
const KNOWN_RECURRING_PATTERNS = [
  // Subscriptions
  /netflix/i, /spotify/i, /hulu/i, /disney/i, /hbo/i, /paramount/i, /peacock/i,
  /apple\s*(tv|music|one|arcade|icloud)/i, /youtube\s*prem/i, /amazon\s*prime/i,
  /audible/i, /dropbox/i, /google\s*one/i, /1password/i, /lastpass/i,
  /nordvpn/i, /expressvpn/i, /adobe/i, /microsoft\s*365/i, /office\s*365/i,
  /chatgpt/i, /openai/i, /github/i, /cursor/i, /copilot/i, /notion/i,
  /figma/i, /canva/i, /slack/i, /zoom/i, /linkedin/i, /grammarly/i,
  // Utilities & Bills
  /\bat&t\b/i, /t-mobile/i, /verizon/i, /comcast/i, /xfinity/i, /spectrum/i,
  /cox\s*comm/i, /centurylink/i, /oncor/i, /electric/i, /water\s*dept/i,
  /gas\s*co/i, /energy/i, /power/i, /internet/i,
  // Insurance
  /geico/i, /state\s*farm/i, /allstate/i, /progressive/i, /liberty\s*mutual/i,
  /usaa\s*ins/i, /farmers/i, /nationwide/i, /insurance/i, /casualty/i,
  // Housing
  /mortgage/i, /freedom\s*mortgage/i, /quicken\s*loans/i, /rocket\s*mortgage/i,
  /mr\s*cooper/i, /loan\s*care/i, /hoa\b/i,
  // Memberships & Fitness
  /planet\s*fitness/i, /anytime\s*fitness/i, /gym/i, /ymca/i, /crossfit/i,
  /costco\s*member/i, /sam'?s\s*club\s*member/i, /amazon\s*(?:fresh|warehouse)/i,
  // Financial
  /interest\s*charge/i, /finance\s*charge/i, /minimum\s*payment/i,
  /e-?payment/i, /autopay/i, /auto\s*pay/i, /scheduled\s*payment/i,
]

function isKnownRecurring(merchant) {
  const text = merchant || ''
  return KNOWN_RECURRING_PATTERNS.some(p => p.test(text))
}

/**
 * Main detection function.
 */
export function detectRecurring(transactions) {
  // Only look at spending (debit, not income)
  // Include transfers too — card payments and bill pays are recurring
  const candidates = transactions.filter(
    t => t.direction === 'debit' && !t.isIncome
  )

  // Group by normalized merchant
  const byMerchant = {}
  for (const t of candidates) {
    const key = normalizeMerchant(t.merchant || t.description)
    if (!key || key.length < 2) continue
    if (!byMerchant[key]) byMerchant[key] = { txns: [], rawNames: new Set() }
    byMerchant[key].txns.push(t)
    byMerchant[key].rawNames.add(t.merchant || t.description)
  }

  const recurring = []

  for (const [normalizedName, { txns, rawNames }] of Object.entries(byMerchant)) {
    if (txns.length < MIN_OCCURRENCES) continue

    // Sort by date
    const sorted = txns.sort((a, b) => new Date(a.date) - new Date(b.date))
    const amounts = sorted.map(t => Math.abs(t.amount))

    // --- Amount clustering ---
    // Instead of requiring ALL amounts to match, find the largest cluster
    // of similar amounts (within 20% of cluster median)
    const clusters = clusterAmounts(amounts, 0.20)
    const largestCluster = clusters.sort((a, b) => b.indices.length - a.indices.length)[0]

    // Use the cluster that contains the most transactions
    const clusterTxns = largestCluster.indices.map(i => sorted[i])
    const clusterAmts = largestCluster.indices.map(i => amounts[i])

    // Need at least MIN_OCCURRENCES in the cluster
    if (clusterTxns.length < MIN_OCCURRENCES) continue

    // --- Cadence detection (majority-based) ---
    const clusterSorted = clusterTxns.sort((a, b) => new Date(a.date) - new Date(b.date))
    const intervals = []
    for (let i = 1; i < clusterSorted.length; i++) {
      const daysDiff = (new Date(clusterSorted[i].date) - new Date(clusterSorted[i - 1].date)) / (86400000)
      intervals.push(daysDiff)
    }

    if (intervals.length === 0) continue

    // Find best matching cadence using majority voting
    const knownBoost = isKnownRecurring(sorted[sorted.length - 1].merchant || sorted[sorted.length - 1].description)
    const cadenceResult = detectCadence(intervals, knownBoost)

    if (!cadenceResult) continue

    // --- Build result ---
    const avgAmount = clusterAmts.reduce((s, a) => s + a, 0) / clusterAmts.length
    const displayName = sorted[sorted.length - 1].merchant || sorted[sorted.length - 1].description
    const category = sorted[sorted.length - 1].category

    recurring.push({
      merchant: displayName,
      normalizedMerchant: normalizedName,
      frequency: cadenceResult.name,
      avgAmount,
      lastAmount: amounts[amounts.length - 1],
      occurrences: sorted.length,
      ytdTotal: amounts.reduce((s, a) => s + a, 0),
      monthlyEstimate: avgAmount * cadenceResult.monthly,
      annualEstimate: avgAmount * cadenceResult.annual,
      lastDate: sorted[sorted.length - 1].date,
      firstDate: sorted[0].date,
      category,
      transactionIds: sorted.map(t => t.id),
    })
  }

  // Sort by monthly cost descending
  return recurring.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}

/**
 * Cluster amounts that are within `tolerance` (fraction) of each other.
 * Returns array of { median, indices } sorted by cluster size descending.
 */
function clusterAmounts(amounts, tolerance) {
  if (amounts.length === 0) return []

  // Simple greedy clustering
  const used = new Set()
  const clusters = []

  // Sort indices by amount for efficient clustering
  const sortedIndices = amounts.map((_, i) => i).sort((a, b) => amounts[a] - amounts[b])

  for (const seedIdx of sortedIndices) {
    if (used.has(seedIdx)) continue

    const cluster = [seedIdx]
    used.add(seedIdx)
    const seedAmount = amounts[seedIdx]

    for (const otherIdx of sortedIndices) {
      if (used.has(otherIdx)) continue
      const diff = Math.abs(amounts[otherIdx] - seedAmount)
      if (seedAmount > 0 && diff / seedAmount <= tolerance) {
        cluster.push(otherIdx)
        used.add(otherIdx)
      }
    }

    const vals = cluster.map(i => amounts[i])
    const median = vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)]

    clusters.push({ median, indices: cluster })
  }

  return clusters
}

/**
 * Detect cadence from intervals using majority voting.
 * Returns the best matching cadence or null.
 *
 * - For regular merchants: >= 60% of intervals must match a cadence
 * - For known recurring: >= 40% (more lenient)
 */
function detectCadence(intervals, isKnown) {
  if (intervals.length === 0) return null

  const threshold = isKnown ? 0.40 : 0.60

  let bestCadence = null
  let bestScore = 0

  for (const cadence of CADENCES) {
    const matchCount = intervals.filter(d => d >= cadence.minDays && d <= cadence.maxDays).length
    const score = matchCount / intervals.length

    if (score >= threshold && score > bestScore) {
      bestScore = score
      bestCadence = cadence
    }
  }

  // Special case: only 1 interval (2 transactions)
  // For known recurring merchants, be lenient; for others, require a tighter match
  if (intervals.length === 1 && !bestCadence) {
    const d = intervals[0]
    for (const cadence of CADENCES) {
      if (d >= cadence.minDays && d <= cadence.maxDays) {
        bestCadence = cadence
        break
      }
    }
    // If only 2 transactions and not a known merchant, skip (too little data)
    if (bestCadence && !isKnown) return null
  }

  return bestCadence
}

/**
 * Normalize merchant name for grouping.
 * Balances removing noise while keeping enough to distinguish merchants.
 */
function normalizeMerchant(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s*#\s*\d+/g, '')           // Remove store numbers like "#1234"
    .replace(/\s+\d{4,}/g, '')            // Remove long number suffixes
    .replace(/\s*(city|state)\s*,?\s*[a-z]{2}\s*$/i, '') // Remove trailing city/state
    .replace(/[*]+/g, '')                  // Remove asterisks
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .replace(/[^a-z0-9&\s\-\.]/g, '')     // Keep letters, numbers, &, -, .
    .trim()
}

/**
 * Get all transaction IDs that belong to recurring items
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

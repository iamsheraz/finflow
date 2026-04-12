import { db } from '@/db/index'
import { detectRecurring } from '@/lib/recurringDetector'

/**
 * Executes a tool call against the local Dexie database.
 * Returns a JSON string result that gets sent back to Claude.
 */
export async function executeToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case 'search_transactions':
        return await searchTransactions(toolInput)
      case 'sum_spending':
        return await sumSpending(toolInput)
      case 'get_spending_by_category':
        return await getSpendingByCategory(toolInput)
      case 'get_budget_status':
        return await getBudgetStatus(toolInput)
      case 'get_account_summary':
        return await getAccountSummary()
      case 'get_recurring_expenses':
        return await getRecurringExpenses()
      case 'get_top_merchants':
        return await getTopMerchants(toolInput)
      case 'get_income_summary':
        return await getIncomeSummary(toolInput)
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err.message })
  }
}

/**
 * Filter transactions by various criteria.
 */
function filterTransactions(allTxns, filters) {
  let txns = allTxns

  if (filters.year) {
    txns = txns.filter(t => new Date(t.date).getFullYear() === filters.year)
  }
  if (filters.month) {
    txns = txns.filter(t => new Date(t.date).getMonth() + 1 === filters.month)
  }
  if (filters.merchant) {
    const search = filters.merchant.toLowerCase()
    txns = txns.filter(t =>
      (t.merchant || '').toLowerCase().includes(search) ||
      (t.description || '').toLowerCase().includes(search)
    )
  }
  if (filters.category) {
    txns = txns.filter(t => t.category === filters.category)
  }
  if (filters.direction) {
    txns = txns.filter(t => t.direction === filters.direction)
  }
  if (filters.min_amount !== undefined) {
    txns = txns.filter(t => Math.abs(t.amount) >= filters.min_amount)
  }
  if (filters.max_amount !== undefined) {
    txns = txns.filter(t => Math.abs(t.amount) <= filters.max_amount)
  }
  if (filters.exclude_transfers !== false) {
    txns = txns.filter(t => !t.isTransfer)
  }

  return txns
}

async function searchTransactions(input) {
  const allTxns = await db.transactions.toArray()
  let results = filterTransactions(allTxns, input)

  // Sort by date descending
  results.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Limit results
  const limit = input.limit || 50
  results = results.slice(0, limit)

  // Format for Claude (only relevant fields, no IDs)
  const formatted = results.map(t => ({
    date: t.date,
    merchant: t.merchant || t.description || 'Unknown',
    amount: Math.abs(t.amount).toFixed(2),
    direction: t.direction,
    category: t.category || 'Uncategorized',
    isTransfer: t.isTransfer || false,
    isIncome: t.isIncome || false,
  }))

  return JSON.stringify({
    count: formatted.length,
    total_matching: filterTransactions(allTxns, input).length,
    transactions: formatted,
  })
}

async function sumSpending(input) {
  const allTxns = await db.transactions.toArray()
  const filters = { ...input, direction: 'debit' }
  if (filters.exclude_transfers === undefined) filters.exclude_transfers = true

  const txns = filterTransactions(allTxns, filters)
    .filter(t => !t.isIncome)

  const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Group by merchant for breakdown
  const byMerchant = {}
  for (const t of txns) {
    const m = t.merchant || t.description || 'Unknown'
    if (!byMerchant[m]) byMerchant[m] = { total: 0, count: 0 }
    byMerchant[m].total += Math.abs(t.amount)
    byMerchant[m].count++
  }

  const merchantBreakdown = Object.entries(byMerchant)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15)
    .map(([name, data]) => ({
      merchant: name,
      total: data.total.toFixed(2),
      transactions: data.count,
    }))

  return JSON.stringify({
    total_amount: total.toFixed(2),
    transaction_count: txns.length,
    merchant_breakdown: merchantBreakdown,
  })
}

async function getSpendingByCategory(input) {
  const allTxns = await db.transactions.toArray()
  const filters = { ...input, direction: 'debit', exclude_transfers: true }
  const txns = filterTransactions(allTxns, filters)
    .filter(t => !t.isIncome)

  const byCategory = {}
  for (const t of txns) {
    const cat = t.category || 'Other'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
    byCategory[cat].total += Math.abs(t.amount)
    byCategory[cat].count++
  }

  const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const categories = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => ({
      category: name,
      total: data.total.toFixed(2),
      transactions: data.count,
      percent: total > 0 ? ((data.total / total) * 100).toFixed(1) : '0',
    }))

  return JSON.stringify({
    total_spending: total.toFixed(2),
    categories,
  })
}

async function getBudgetStatus(input) {
  const budgets = await db.budgets.toArray()
  const allTxns = await db.transactions.toArray()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const monthlyTxns = filterTransactions(allTxns, {
    year, month, direction: 'debit', exclude_transfers: true,
  }).filter(t => !t.isIncome)

  const spendByCategory = {}
  for (const t of monthlyTxns) {
    const cat = t.category || 'Other'
    spendByCategory[cat] = (spendByCategory[cat] || 0) + Math.abs(t.amount)
  }

  let results = budgets
  if (input.category) {
    results = results.filter(b => b.category === input.category)
  }

  const budgetStatus = results.map(b => {
    const spent = spendByCategory[b.category] || 0
    const percent = b.monthlyLimit > 0 ? (spent / b.monthlyLimit * 100) : 0
    return {
      category: b.category,
      monthly_limit: b.monthlyLimit.toFixed(2),
      spent: spent.toFixed(2),
      remaining: (b.monthlyLimit - spent).toFixed(2),
      percent_used: percent.toFixed(1),
      status: percent > 100 ? 'OVER_BUDGET' : percent > 80 ? 'WARNING' : 'ON_TRACK',
    }
  })

  const totalBudget = results.reduce((s, b) => s + b.monthlyLimit, 0)
  const totalSpent = results.reduce((s, b) => s + (spendByCategory[b.category] || 0), 0)

  return JSON.stringify({
    month: `${year}-${String(month).padStart(2, '0')}`,
    total_budget: totalBudget.toFixed(2),
    total_spent: totalSpent.toFixed(2),
    budgets: budgetStatus,
  })
}

async function getAccountSummary() {
  const accounts = await db.accounts.toArray()

  const formatted = accounts.map(a => ({
    name: a.name || `${a.type} Account`,
    type: a.type === 'credit' ? 'Credit Card' : 'Bank Account',
    last4: a.last4 || '????',
    currency: a.currency || 'USD',
    credit_limit: a.creditLimit || null,
  }))

  return JSON.stringify({
    total_accounts: formatted.length,
    accounts: formatted,
  })
}

async function getRecurringExpenses() {
  const allTxns = await db.transactions.toArray()
  const recurring = detectRecurring(allTxns)

  const formatted = recurring.map(r => ({
    merchant: r.merchant,
    category: r.category || 'Uncategorized',
    monthly_cost: r.monthlyEstimate.toFixed(2),
    annual_cost: r.annualEstimate.toFixed(2),
    frequency: r.frequency || 'monthly',
    occurrences: r.count || 0,
  }))

  const totalMonthly = recurring.reduce((s, r) => s + r.monthlyEstimate, 0)
  const totalAnnual = recurring.reduce((s, r) => s + r.annualEstimate, 0)

  return JSON.stringify({
    total_monthly: totalMonthly.toFixed(2),
    total_annual: totalAnnual.toFixed(2),
    count: formatted.length,
    subscriptions: formatted,
  })
}

async function getTopMerchants(input) {
  const allTxns = await db.transactions.toArray()
  const filters = { ...input, direction: 'debit', exclude_transfers: true }
  const txns = filterTransactions(allTxns, filters)
    .filter(t => !t.isIncome)

  const byMerchant = {}
  for (const t of txns) {
    const m = t.merchant || t.description || 'Unknown'
    if (!byMerchant[m]) byMerchant[m] = { total: 0, count: 0, category: t.category }
    byMerchant[m].total += Math.abs(t.amount)
    byMerchant[m].count++
  }

  const limit = input.limit || 10
  const merchants = Object.entries(byMerchant)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([name, data]) => ({
      merchant: name,
      total: data.total.toFixed(2),
      transactions: data.count,
      category: data.category || 'Other',
    }))

  return JSON.stringify({
    period: input.month ? `${input.year}-${String(input.month).padStart(2, '0')}` : `${input.year || 'all-time'}`,
    top_merchants: merchants,
  })
}

async function getIncomeSummary(input) {
  const allTxns = await db.transactions.toArray()
  let txns = allTxns.filter(t => t.isIncome)

  if (input.year) txns = txns.filter(t => new Date(t.date).getFullYear() === input.year)
  if (input.month) txns = txns.filter(t => new Date(t.date).getMonth() + 1 === input.month)

  const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Group by source
  const bySrc = {}
  for (const t of txns) {
    const src = t.merchant || t.description || 'Unknown'
    if (!bySrc[src]) bySrc[src] = { total: 0, count: 0 }
    bySrc[src].total += Math.abs(t.amount)
    bySrc[src].count++
  }

  const sources = Object.entries(bySrc)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => ({
      source: name,
      total: data.total.toFixed(2),
      deposits: data.count,
    }))

  return JSON.stringify({
    total_income: total.toFixed(2),
    deposit_count: txns.length,
    sources,
  })
}

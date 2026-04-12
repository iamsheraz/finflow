import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { detectRecurring } from '@/lib/recurringDetector'

/**
 * Builds a text summary of the user's financial data
 * to inject into the chatbot's system prompt context.
 * All data stays client-side — only the summary string is sent to the API.
 */
export function useFinanceContext() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const transactions = useLiveQuery(() => db.transactions.toArray()) || []
  const budgets = useLiveQuery(() => db.budgets.toArray()) || []

  const context = useMemo(() => {
    if (transactions.length === 0) return null

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // Current month transactions
    const monthly = transactions.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })

    // Spending
    const spending = monthly.filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')
    const totalSpending = spending.reduce((s, t) => s + Math.abs(t.amount), 0)

    // Income
    const incomeTotal = monthly.filter(t => t.isIncome).reduce((s, t) => s + Math.abs(t.amount), 0)

    // Savings rate
    const savingsRate = incomeTotal > 0 ? ((incomeTotal - totalSpending) / incomeTotal * 100).toFixed(1) : 0

    // By category
    const byCategory = {}
    for (const t of spending) {
      const cat = t.category || 'Other'
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0, merchants: {} }
      byCategory[cat].total += Math.abs(t.amount)
      byCategory[cat].count++
      const merch = t.merchant || t.description || 'Unknown'
      byCategory[cat].merchants[merch] = (byCategory[cat].merchants[merch] || 0) + Math.abs(t.amount)
    }

    // Budget status
    const budgetLines = budgets.map(b => {
      const catSpend = byCategory[b.category]?.total || 0
      const pct = b.monthlyLimit > 0 ? (catSpend / b.monthlyLimit * 100).toFixed(0) : 0
      const status = pct > 100 ? 'OVER' : pct > 80 ? 'WARNING' : 'OK'
      return `  - ${b.category}: $${catSpend.toFixed(0)} / $${b.monthlyLimit} (${pct}%) [${status}]`
    })

    // Accounts
    const accountLines = accounts.map(a => {
      const type = a.type === 'credit' ? 'Credit Card' : 'Bank Account'
      return `  - ${a.name || type} (****${a.last4 || '????'}) — ${type}`
    })

    // Credit utilization
    const creditAccounts = accounts.filter(a => a.type === 'credit')
    const creditLines = creditAccounts.map(a => {
      const cardTxns = monthly.filter(t => t.accountId === a.id && t.direction === 'debit' && !t.isTransfer)
      const used = cardTxns.reduce((s, t) => s + Math.abs(t.amount), 0)
      const limit = a.creditLimit || 0
      const pct = limit > 0 ? (used / limit * 100).toFixed(0) : 'N/A'
      return `  - ${a.name} (****${a.last4}): $${used.toFixed(0)} used${limit ? ` / $${limit} limit (${pct}%)` : ''}`
    })

    // Top merchants
    const allMerchants = {}
    for (const t of spending) {
      const m = t.merchant || t.description || 'Unknown'
      allMerchants[m] = (allMerchants[m] || 0) + Math.abs(t.amount)
    }
    const topMerchants = Object.entries(allMerchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([m, amt]) => `  - ${m}: $${amt.toFixed(0)}`)

    // Recurring
    const recurring = detectRecurring(transactions)
    const recurringLines = recurring.slice(0, 8).map(r =>
      `  - ${r.merchant}: $${r.monthlyEstimate.toFixed(0)}/mo (${r.category || 'Uncategorized'})`
    )
    const recurringTotal = recurring.reduce((s, r) => s + r.monthlyEstimate, 0)

    // Category breakdown
    const catLines = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, data]) => `  - ${cat}: $${data.total.toFixed(0)} (${data.count} transactions)`)

    // Build context string
    const parts = [
      `Month: ${now.toLocaleString('default', { month: 'long' })} ${year}`,
      `Total transactions this month: ${monthly.length}`,
      '',
      `SPENDING SUMMARY:`,
      `  Total spending: $${totalSpending.toFixed(0)}`,
      `  Total income: $${incomeTotal.toFixed(0)}`,
      `  Savings rate: ${savingsRate}%`,
      '',
      `SPENDING BY CATEGORY:`,
      ...catLines,
    ]

    if (budgetLines.length > 0) {
      parts.push('', 'BUDGET STATUS:', ...budgetLines)
    }

    if (accountLines.length > 0) {
      parts.push('', 'ACCOUNTS:', ...accountLines)
    }

    if (creditLines.length > 0) {
      parts.push('', 'CREDIT CARD UTILIZATION:', ...creditLines)
    }

    if (topMerchants.length > 0) {
      parts.push('', 'TOP MERCHANTS THIS MONTH:', ...topMerchants)
    }

    if (recurringLines.length > 0) {
      parts.push('', `RECURRING/SUBSCRIPTIONS ($${recurringTotal.toFixed(0)}/mo total):`, ...recurringLines)
    }

    return parts.join('\n')
  }, [accounts, transactions, budgets])

  return context
}

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { transactionsRepo } from '@/db/transactions'

export function useTransactions(year, month) {
  const all = useLiveQuery(
    () => db.transactions.toArray(),
    []
  ) || []

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []

  const accountMap = useMemo(() => {
    const map = {}
    for (const a of accounts) map[a.id] = a
    return map
  }, [accounts])

  const filtered = all.filter(t => {
    if (!year || !month) return true
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const realSpending = filtered
    .filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const income = filtered
    .filter(t => t.isIncome)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const transfers = filtered.filter(t => t.isTransfer)

  const transferTotal = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const grossOutgoing = filtered
    .filter(t => t.direction === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const savingsRate = income > 0 ? ((income - realSpending) / income) * 100 : 0

  const spendingByCategory = {}
  for (const t of filtered.filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')) {
    const cat = t.category || 'Other'
    if (!spendingByCategory[cat]) spendingByCategory[cat] = { total: 0, count: 0 }
    spendingByCategory[cat].total += Math.abs(t.amount)
    spendingByCategory[cat].count++
  }

  const needsReview = filtered.filter(t => !t.isTransfer && !t.isIncome && !t.category)

  // ── Smart cash flow metrics ──
  const cashFlow = useMemo(() => {
    const spending = filtered.filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')

    // Debit spending = purchases from debit/checking accounts (real cash leaving NOW)
    const debitSpending = spending
      .filter(t => accountMap[t.accountId]?.type !== 'credit')
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    // Credit spending = charges on credit cards (future liability, not cash yet)
    const creditSpending = spending
      .filter(t => accountMap[t.accountId]?.type === 'credit')
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    // Credit card payments = transfer debits FROM debit accounts TO credit accounts
    // These are the actual cash outflows for credit card bills
    const creditPayments = filtered
      .filter(t => t.isTransfer && t.direction === 'debit' && accountMap[t.accountId]?.type !== 'credit')
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    // Cash In = income deposited
    const cashIn = income

    // Cash Out = debit spending + credit card payments (actual bank withdrawals)
    const cashOut = debitSpending + creditPayments

    // Net Cash Flow = did your bank balance go up or down?
    const netCashFlow = cashIn - cashOut

    // Cash-based savings rate (more accurate than blended)
    const cashSavingsRate = cashIn > 0 ? (netCashFlow / cashIn) * 100 : 0

    // Credit Delta = are you accumulating debt or paying it down?
    // Negative = paying more than spending (good), Positive = debt growing
    const creditDelta = creditSpending - creditPayments

    return {
      debitSpending,
      creditSpending,
      creditPayments,
      creditDelta,
      cashIn,
      cashOut,
      netCashFlow,
      cashSavingsRate,
    }
  }, [filtered, accountMap, income])

  return {
    transactions: filtered,
    allTransactions: all,
    realSpending,
    income,
    transfers,
    transferTotal,
    grossOutgoing,
    savingsRate,
    spendingByCategory,
    needsReview,
    cashFlow,
    accountMap,
  }
}

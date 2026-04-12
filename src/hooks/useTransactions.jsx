import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { transactionsRepo } from '@/db/transactions'

export function useTransactions(year, month) {
  const all = useLiveQuery(
    () => db.transactions.toArray(),
    []
  ) || []

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
  }
}

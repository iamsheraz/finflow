import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { detectRecurring } from '@/lib/recurringDetector'

export function useRecurring() {
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || []

  const recurring = useMemo(() => {
    if (allTransactions.length === 0) return []
    return detectRecurring(allTransactions)
  }, [allTransactions])

  const totalMonthly = recurring.reduce((s, r) => s + r.monthlyEstimate, 0)
  const totalAnnual = recurring.reduce((s, r) => s + r.annualEstimate, 0)

  return {
    recurring,
    totalMonthly,
    totalAnnual,
    count: recurring.length,
  }
}

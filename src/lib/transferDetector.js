/**
 * Detects transfer pairs across accounts.
 * A transfer is when money leaves one account and enters another
 * with matching amount and near date (within 5 days).
 */

const MAX_DATE_DIFF_DAYS = 5

export function detectTransferPairs(transactions) {
  const debits = transactions.filter(t => t.direction === 'debit' && !t.isIncome)
  const credits = transactions.filter(t => t.direction === 'credit' && !t.isIncome)

  const pairs = []
  const matchedDebitIds = new Set()
  const matchedCreditIds = new Set()

  for (const debit of debits) {
    if (matchedDebitIds.has(debit.id)) continue

    for (const credit of credits) {
      if (matchedCreditIds.has(credit.id)) continue
      if (debit.accountId === credit.accountId) continue

      // Check amount match (within $0.01 for rounding)
      const amountMatch = Math.abs(Math.abs(debit.amount) - Math.abs(credit.amount)) < 0.02

      // Check date proximity
      const debitDate = new Date(debit.date)
      const creditDate = new Date(credit.date)
      const daysDiff = Math.abs((debitDate - creditDate) / (1000 * 60 * 60 * 24))
      const dateMatch = daysDiff <= MAX_DATE_DIFF_DAYS

      if (amountMatch && dateMatch) {
        pairs.push({
          fromTxnId: debit.id,
          toTxnId: credit.id,
          amount: Math.abs(debit.amount),
          confidence: 'auto',
        })
        matchedDebitIds.add(debit.id)
        matchedCreditIds.add(credit.id)
        break
      }
    }
  }

  return pairs
}

export function getTransferTransactionIds(pairs) {
  const ids = new Set()
  for (const pair of pairs) {
    ids.add(pair.fromTxnId)
    ids.add(pair.toTxnId)
  }
  return ids
}

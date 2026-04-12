import Dexie from 'dexie'

export const db = new Dexie('finflow')

db.version(1).stores({
  accounts: '++id, name, type, last4, currency',
  transactions: '++id, accountId, date, merchant, category, isTransfer, transferPairId, isRecurring, isIncome, [accountId+date]',
  transferPairs: '++id, fromTxnId, toTxnId, amount, confidence',
  statementUploads: '++id, accountId, month, year, uploadedAt, status, [accountId+month+year]',
  budgets: '++id, category, monthlyLimit, currentSpend',
  userPreferences: '++id, &key, value',
  categoryRules: '++id, merchantPattern, category, source, createdAt',
})

// v2: add verified field to transactions
db.version(2).stores({
  accounts: '++id, name, type, last4, currency',
  transactions: '++id, accountId, date, merchant, category, isTransfer, transferPairId, isRecurring, isIncome, verified, [accountId+date]',
  transferPairs: '++id, fromTxnId, toTxnId, amount, confidence',
  statementUploads: '++id, accountId, month, year, uploadedAt, status, [accountId+month+year]',
  budgets: '++id, category, monthlyLimit, currentSpend',
  userPreferences: '++id, &key, value',
  categoryRules: '++id, merchantPattern, category, source, createdAt',
}).upgrade(tx => {
  return tx.table('transactions').toCollection().modify(t => {
    if (t.verified === undefined) t.verified = false
  })
})

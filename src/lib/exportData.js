import { db } from '@/db/index'

/**
 * Export all data as JSON.
 */
export async function exportJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts: await db.accounts.toArray(),
    transactions: await db.transactions.toArray(),
    transferPairs: await db.transferPairs.toArray(),
    statementUploads: await db.statementUploads.toArray(),
    budgets: await db.budgets.toArray(),
    userPreferences: await db.userPreferences.toArray(),
    categoryRules: await db.categoryRules.toArray(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `finflow-backup-${formatDateForFilename()}.json`)
}

/**
 * Export transactions as CSV.
 */
export async function exportCSV() {
  const transactions = await db.transactions.toArray()
  const accounts = await db.accounts.toArray()
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  const headers = ['Date', 'Account', 'Description', 'Merchant', 'Category', 'Amount', 'Direction', 'Is Transfer', 'Is Income']
  const rows = transactions.map(t => [
    new Date(t.date).toLocaleDateString(),
    accountMap[t.accountId] || '',
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${(t.merchant || '').replace(/"/g, '""')}"`,
    t.category || '',
    t.amount.toFixed(2),
    t.direction,
    t.isTransfer ? 'Yes' : 'No',
    t.isIncome ? 'Yes' : 'No',
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  downloadBlob(blob, `finflow-transactions-${formatDateForFilename()}.csv`)
}

/**
 * Import from a JSON backup file.
 */
export async function importJSON(file) {
  const text = await file.text()
  const data = JSON.parse(text)

  if (!data.version || !data.accounts || !data.transactions) {
    throw new Error('Invalid backup file format')
  }

  // Clear existing data
  await db.transaction('rw',
    db.accounts, db.transactions, db.transferPairs,
    db.statementUploads, db.budgets, db.userPreferences, db.categoryRules,
    async () => {
      await db.accounts.clear()
      await db.transactions.clear()
      await db.transferPairs.clear()
      await db.statementUploads.clear()
      await db.budgets.clear()
      await db.userPreferences.clear()
      await db.categoryRules.clear()

      if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts)
      if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions)
      if (data.transferPairs?.length) await db.transferPairs.bulkAdd(data.transferPairs)
      if (data.statementUploads?.length) await db.statementUploads.bulkAdd(data.statementUploads)
      if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets)
      if (data.userPreferences?.length) await db.userPreferences.bulkAdd(data.userPreferences)
      if (data.categoryRules?.length) await db.categoryRules.bulkAdd(data.categoryRules)
    }
  )

  // Notify the app that data was imported so month selector updates
  window.dispatchEvent(new Event('finflow:data-imported'))

  return {
    accounts: data.accounts?.length || 0,
    transactions: data.transactions?.length || 0,
  }
}

/**
 * Clear all data from the database.
 */
export async function clearAllData() {
  await db.transaction('rw',
    db.accounts, db.transactions, db.transferPairs,
    db.statementUploads, db.budgets, db.userPreferences, db.categoryRules,
    async () => {
      await db.accounts.clear()
      await db.transactions.clear()
      await db.transferPairs.clear()
      await db.statementUploads.clear()
      await db.budgets.clear()
      await db.userPreferences.clear()
      await db.categoryRules.clear()
    }
  )
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDateForFilename() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

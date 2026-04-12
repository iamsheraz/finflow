import { db } from './index'

export const transactionsRepo = {
  async getAll() {
    return db.transactions.toArray()
  },

  async getByAccountId(accountId) {
    return db.transactions.where('accountId').equals(accountId).toArray()
  },

  async getByMonth(year, month) {
    const all = await db.transactions.toArray()
    return all.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  },

  async bulkAdd(transactions) {
    return db.transactions.bulkAdd(transactions)
  },

  async update(id, changes) {
    return db.transactions.update(id, changes)
  },

  async delete(id) {
    return db.transactions.delete(id)
  },

  async setVerified(id, verified) {
    return db.transactions.update(id, { verified })
  },

  async bulkSetVerified(ids, verified) {
    return db.transaction('rw', db.transactions, () => {
      return Promise.all(ids.map(id => db.transactions.update(id, { verified })))
    })
  },

  async getSpendingByCategory(year, month) {
    const txns = await this.getByMonth(year, month)
    const spending = txns.filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')
    const byCategory = {}
    for (const t of spending) {
      const cat = t.category || 'Other'
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0, transactions: [] }
      byCategory[cat].total += Math.abs(t.amount)
      byCategory[cat].count++
      byCategory[cat].transactions.push(t)
    }
    return byCategory
  },

  async getRealSpending(year, month) {
    const txns = await this.getByMonth(year, month)
    return txns
      .filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  },

  async getIncome(year, month) {
    const txns = await this.getByMonth(year, month)
    return txns
      .filter(t => t.isIncome)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  },

  async getTransfers(year, month) {
    const txns = await this.getByMonth(year, month)
    return txns.filter(t => t.isTransfer)
  },

  async getUnclassified(year, month) {
    const txns = await this.getByMonth(year, month)
    return txns.filter(t => !t.isTransfer && !t.isIncome && !t.category)
  },
}

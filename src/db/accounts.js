import { db } from './index'

export const accountsRepo = {
  async getAll() {
    return db.accounts.toArray()
  },

  async getById(id) {
    return db.accounts.get(id)
  },

  async getByLast4(last4) {
    return db.accounts.where('last4').equals(last4).first()
  },

  async create(account) {
    return db.accounts.add({
      ...account,
      currency: account.currency || 'USD',
    })
  },

  async update(id, changes) {
    return db.accounts.update(id, changes)
  },

  async delete(id) {
    return db.accounts.delete(id)
  },
}

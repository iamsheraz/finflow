import { db } from './index'

export const budgetsRepo = {
  async getAll() {
    return db.budgets.toArray()
  },

  async getByCategory(category) {
    return db.budgets.where('category').equals(category).first()
  },

  async set(category, monthlyLimit) {
    const existing = await this.getByCategory(category)
    if (existing) {
      return db.budgets.update(existing.id, { monthlyLimit })
    }
    return db.budgets.add({ category, monthlyLimit, currentSpend: 0 })
  },

  async delete(id) {
    return db.budgets.delete(id)
  },

  async deleteByCategory(category) {
    return db.budgets.where('category').equals(category).delete()
  },
}

import { db } from './index'

export const categoryRulesRepo = {
  async getAll() {
    return db.categoryRules.toArray()
  },

  async create(rule) {
    return db.categoryRules.add({
      ...rule,
      createdAt: new Date().toISOString(),
    })
  },

  async findByMerchant(merchant) {
    const rules = await this.getAll()
    const normalized = merchant.toLowerCase()
    return rules.find(r => normalized.includes(r.merchantPattern.toLowerCase()))
  },

  async delete(id) {
    return db.categoryRules.delete(id)
  },
}

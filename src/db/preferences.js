import { db } from './index'

export const preferencesRepo = {
  async get(key) {
    const pref = await db.userPreferences.where('key').equals(key).first()
    return pref?.value
  },

  async set(key, value) {
    const existing = await db.userPreferences.where('key').equals(key).first()
    if (existing) {
      return db.userPreferences.update(existing.id, { value })
    }
    return db.userPreferences.add({ key, value })
  },

  async getTheme() {
    return (await this.get('theme')) || 'dark'
  },

  async setTheme(theme) {
    return this.set('theme', theme)
  },
}

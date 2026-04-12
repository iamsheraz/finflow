import { db } from './index'

export const statementsRepo = {
  async getAll() {
    return db.statementUploads.toArray()
  },

  async getByAccount(accountId) {
    return db.statementUploads.where('accountId').equals(accountId).toArray()
  },

  async exists(accountId, month, year) {
    return db.statementUploads
      .where('[accountId+month+year]')
      .equals([accountId, month, year])
      .first()
  },

  async create(upload) {
    return db.statementUploads.add({
      ...upload,
      uploadedAt: new Date().toISOString(),
      status: upload.status || 'complete',
    })
  },
}

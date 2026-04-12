import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { accountsRepo } from '@/db/accounts'

export function useAccounts() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || []

  return {
    accounts,
    createAccount: accountsRepo.create.bind(accountsRepo),
    updateAccount: accountsRepo.update.bind(accountsRepo),
    deleteAccount: accountsRepo.delete.bind(accountsRepo),
    getByLast4: accountsRepo.getByLast4.bind(accountsRepo),
  }
}

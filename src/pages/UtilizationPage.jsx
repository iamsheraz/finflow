import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency } from '@/lib/formatters'

export default function UtilizationPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { year, month } = useMonth()
  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const transactions = useLiveQuery(() => db.transactions.toArray()) || []
  const creditAccounts = accounts.filter(a => a.type === 'credit')

  // Compute per-card balance from transactions for the selected month
  const cardData = useMemo(() => {
    return creditAccounts.map(account => {
      const cardTxns = transactions.filter(t => {
        if (t.accountId !== account.id) return false
        const d = new Date(t.date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })

      // Sum charges (debits) minus payments/credits for this month
      const monthSpending = cardTxns
        .filter(t => t.direction === 'debit')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      const monthCredits = cardTxns
        .filter(t => t.direction === 'credit')
        .reduce((s, t) => s + Math.abs(t.amount), 0)
      const computedBalance = monthSpending - monthCredits

      // Use stored balance if available, otherwise compute from transactions
      const balance = account.balance != null && account.balance > 0
        ? account.balance
        : Math.max(0, computedBalance)
      const limit = account.limit || 0

      return { ...account, balance, limit, monthSpending, monthCredits }
    })
  }, [creditAccounts, transactions, year, month])

  const totalBalance = cardData.reduce((s, a) => s + a.balance, 0)
  const totalLimit = cardData.reduce((s, a) => s + a.limit, 0)
  const overallUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Credit Cards" title="Credit Utilization">
        <MonthSelector />
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Overall Utilization */}
        <Card className="p-6">
          <h3 className={`font-semibold mb-4 ${textMain}`}>Overall Utilization</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className={`flex-1 h-4 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
              <div
                className={`h-full rounded-full util-bar ${overallUtil < 20 ? 'bg-emerald-500' : overallUtil < 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(overallUtil, 100)}%` }}
              />
            </div>
            <span className={`font-mono font-bold text-lg ${overallUtil < 20 ? 'text-emerald-400' : overallUtil < 30 ? 'text-amber-400' : 'text-red-400'}`}>
              {overallUtil.toFixed(0)}%
            </span>
          </div>
          <p className={`text-sm ${textMuted}`}>
            {formatCurrency(totalBalance)} used of {formatCurrency(totalLimit)} total limit across {creditAccounts.length} cards
          </p>
        </Card>

        {/* Per-card breakdown */}
        {cardData.length > 0 ? (
          <div className="space-y-3">
            {cardData
              .sort((a, b) => {
                const utilA = a.limit ? a.balance / a.limit : 0
                const utilB = b.limit ? b.balance / b.limit : 0
                return utilB - utilA
              })
              .map(card => {
                const util = card.limit ? (card.balance / card.limit) * 100 : 0
                const color = util < 20 ? 'emerald' : util < 30 ? 'amber' : 'red'

                return (
                  <Card key={card.id} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold text-sm ${textMain}`}>{card.name}</h4>
                        <p className={`text-xs ${textDim}`}>{card.last4 ? `****${card.last4}` : 'No card number'}</p>
                      </div>
                      <span className={`font-mono font-bold text-lg ${util < 20 ? 'text-emerald-400' : util < 30 ? 'text-amber-400' : 'text-red-400'}`}>{util.toFixed(0)}%</span>
                    </div>
                    <div className={`h-3 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div className={`h-full rounded-full ${util < 20 ? 'bg-emerald-500' : util < 30 ? 'bg-amber-500' : 'bg-red-500'} util-bar`} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className={`text-xs font-mono ${textMuted}`}>Balance: {formatCurrency(card.balance)}</span>
                      <span className={`text-xs font-mono ${textMuted}`}>Limit: {formatCurrency(card.limit)}</span>
                    </div>
                    {/* Monthly spending breakdown */}
                    {(card.monthSpending > 0 || card.monthCredits > 0) && (
                      <div className={`mt-3 flex gap-4 text-xs ${textDim}`}>
                        <span>Charges: <span className="text-red-400 font-mono">{formatCurrency(card.monthSpending)}</span></span>
                        <span>Payments: <span className="text-emerald-400 font-mono">{formatCurrency(card.monthCredits)}</span></span>
                      </div>
                    )}
                    {util > 30 && (
                      <div className={`mt-3 p-2 rounded-lg ${isDark ? 'bg-red-500/5' : 'bg-red-50'} text-xs text-red-400`}>
                        High utilization — pay down {formatCurrency(card.balance - card.limit * 0.3)} to reach 30%
                      </div>
                    )}
                  </Card>
                )
              })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className={`text-sm ${textDim}`}>No credit cards found. Upload a credit card statement to track utilization.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

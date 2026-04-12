import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTheme } from '@/hooks/useTheme'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { formatCurrency } from '@/lib/formatters'

export default function UtilizationPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const creditAccounts = accounts.filter(a => a.type === 'credit')

  const totalBalance = creditAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const totalLimit = creditAccounts.reduce((s, a) => s + (a.limit || 0), 0)
  const overallUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Credit Cards" title="Credit Utilization" />

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
        {creditAccounts.length > 0 ? (
          <div className="space-y-3">
            {creditAccounts
              .sort((a, b) => {
                const utilA = a.limit ? (a.balance || 0) / a.limit : 0
                const utilB = b.limit ? (b.balance || 0) / b.limit : 0
                return utilB - utilA
              })
              .map(account => {
                const util = account.limit ? ((account.balance || 0) / account.limit) * 100 : 0
                const color = util < 20 ? 'emerald' : util < 30 ? 'amber' : 'red'

                return (
                  <Card key={account.id} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-semibold text-sm ${textMain}`}>{account.name}</h4>
                        <p className={`text-xs ${textDim}`}>{account.last4 ? `****${account.last4}` : 'No card number'}</p>
                      </div>
                      <span className={`font-mono font-bold text-lg text-${color}-400`}>{util.toFixed(0)}%</span>
                    </div>
                    <div className={`h-3 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div className={`h-full rounded-full bg-${color}-500 util-bar`} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className={`text-xs font-mono ${textMuted}`}>Balance: {formatCurrency(account.balance || 0)}</span>
                      <span className={`text-xs font-mono ${textMuted}`}>Limit: {formatCurrency(account.limit || 0)}</span>
                    </div>
                    {util > 30 && (
                      <div className={`mt-3 p-2 rounded-lg ${isDark ? 'bg-red-500/5' : 'bg-red-50'} text-xs text-red-400`}>
                        High utilization — pay down {formatCurrency((account.balance || 0) - (account.limit || 0) * 0.3)} to reach 30%
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

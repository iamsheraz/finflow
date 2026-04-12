import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTheme } from '@/hooks/useTheme'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { formatCurrency } from '@/lib/formatters'
import { TrendingUp, Wallet, CreditCard } from 'lucide-react'

export default function NetWorthPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const debitAccounts = accounts.filter(a => a.type === 'debit' || a.type === 'paypal')
  const creditAccounts = accounts.filter(a => a.type === 'credit')

  const totalAssets = debitAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const totalLiabilities = creditAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const netWorth = totalAssets - totalLiabilities

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Net Worth" title="Net Worth" />

      <div className="p-6 space-y-6">
        {/* Net Worth Card */}
        <Card className="p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent" />
          <p className={`text-xs uppercase tracking-wider mb-2 relative ${textMuted}`}>Net Worth</p>
          <p className={`text-4xl font-bold font-mono relative ${netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(netWorth)}
          </p>
          {accounts.length === 0 && (
            <p className={`text-sm mt-2 relative ${textDim}`}>Upload statements to calculate your net worth</p>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${textMain}`}>Assets</h3>
                <p className="text-xs text-emerald-400 font-mono font-bold">{formatCurrency(totalAssets)}</p>
              </div>
            </div>
            {debitAccounts.length > 0 ? (
              <div className={`space-y-3 divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {debitAccounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between pt-3 first:pt-0">
                    <span className={`text-sm ${textMain}`}>{a.name}</span>
                    <span className="font-mono text-sm font-semibold text-emerald-400">{formatCurrency(a.balance || 0)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${textDim}`}>No debit accounts found</p>
            )}
          </Card>

          {/* Liabilities */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${textMain}`}>Liabilities</h3>
                <p className="text-xs text-red-400 font-mono font-bold">{formatCurrency(totalLiabilities)}</p>
              </div>
            </div>
            {creditAccounts.length > 0 ? (
              <div className={`space-y-3 divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {creditAccounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between pt-3 first:pt-0">
                    <span className={`text-sm ${textMain}`}>{a.name}</span>
                    <span className="font-mono text-sm font-semibold text-red-400">-{formatCurrency(a.balance || 0)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${textDim}`}>No credit cards found</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

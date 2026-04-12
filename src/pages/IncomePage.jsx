import { useTransactions } from '@/hooks/useTransactions'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatPercent, formatDate } from '@/lib/formatters'
import { Gift, TrendingUp } from 'lucide-react'

export default function IncomePage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { year, month } = useMonth()

  const { transactions, income, realSpending, savingsRate } = useTransactions(year, month)

  const incomeTxns = transactions.filter(t => t.isIncome)

  // Group by source (merchant/description)
  const sources = {}
  for (const t of incomeTxns) {
    const source = t.merchant || t.description
    if (!sources[source]) sources[source] = { total: 0, count: 0, transactions: [] }
    sources[source].total += Math.abs(t.amount)
    sources[source].count++
    sources[source].transactions.push(t)
  }
  const sortedSources = Object.entries(sources).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Income" title="Income" />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Gift className="w-4 h-4 text-emerald-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Total Income</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${textMain}`}>{formatCurrency(income)}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Savings Rate</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${savingsRate >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{formatPercent(savingsRate)}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Sources</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${textMain}`}>{sortedSources.length}</p>
          </Card>
        </div>

        {/* Income Sources */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <h3 className={`font-semibold text-sm ${textMain}`}>Income Sources</h3>
          </div>
          {sortedSources.length > 0 ? (
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {sortedSources.map(([source, data]) => (
                <div key={source} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-medium text-sm ${textMain}`}>{source}</h4>
                    <span className="font-mono font-bold text-sm text-emerald-400">{formatCurrency(data.total)}</span>
                  </div>
                  <p className={`text-xs ${textDim}`}>{data.count} deposit{data.count !== 1 ? 's' : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.transactions.map(t => (
                      <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-white/5' : 'bg-slate-100'} ${textMuted} font-mono`}>
                        {formatDate(t.date)}: +{formatCurrency(t.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 text-center ${textDim}`}>
              <p className="text-sm">No income detected yet. Upload statements with deposits to see income sources.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

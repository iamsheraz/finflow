import { useRecurring } from '@/hooks/useRecurring'
import { useTheme } from '@/hooks/useTheme'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatCurrencyFull, formatDate } from '@/lib/formatters'
import { RefreshCw, Calendar, DollarSign } from 'lucide-react'

export default function RecurringPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { recurring, totalMonthly, totalAnnual, count } = useRecurring()

  const frequencyLabel = {
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
  }

  const frequencyBadgeColor = {
    weekly: 'bg-blue-500/10 text-blue-400',
    biweekly: 'bg-violet-500/10 text-violet-400',
    monthly: 'bg-emerald-500/10 text-emerald-400',
    quarterly: 'bg-amber-500/10 text-amber-400',
  }

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Recurring" title="Recurring & Subscriptions" />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-violet-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Recurring Items</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${textMain}`}>{count}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Monthly Cost</span>
            </div>
            <p className={`text-2xl font-bold font-mono text-amber-400`}>{formatCurrency(totalMonthly)}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-red-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Annual Estimate</span>
            </div>
            <p className={`text-2xl font-bold font-mono text-red-400`}>{formatCurrency(totalAnnual)}</p>
          </Card>
        </div>

        {/* Recurring Items List */}
        {recurring.length > 0 ? (
          <Card className="overflow-hidden">
            <div className={`px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
              <h3 className={`font-semibold text-sm ${textMain}`}>What am I paying every month?</h3>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {recurring.map((item, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center`}>
                        <RefreshCw className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h4 className={`font-medium text-sm ${textMain}`}>{item.merchant}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${frequencyBadgeColor[item.frequency] || 'bg-slate-500/10 text-slate-400'}`}>
                            {frequencyLabel[item.frequency] || item.frequency}
                          </span>
                          {item.category && (
                            <span className={`text-[10px] ${textDim}`}>{item.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-bold text-sm ${textMain}`}>{formatCurrencyFull(item.lastAmount)}</p>
                      <p className={`text-[10px] ${textDim}`}>
                        {item.occurrences} charges · YTD {formatCurrency(item.ytdTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] ${textDim}`}>
                      Last: {formatDate(item.lastDate)} · First: {formatDate(item.firstDate)}
                    </span>
                    <span className={`text-[10px] font-mono ${textMuted}`}>
                      ~{formatCurrency(item.monthlyEstimate)}/mo · ~{formatCurrency(item.annualEstimate)}/yr
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <RefreshCw className={`w-12 h-12 mx-auto mb-3 ${textDim}`} />
            <p className={`text-sm ${textDim}`}>No recurring transactions detected yet.</p>
            <p className={`text-xs mt-1 ${textDim}`}>Upload at least 2 months of statements to detect subscriptions and recurring bills.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

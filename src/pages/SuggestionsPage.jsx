import { useNavigate } from 'react-router-dom'
import { useTransactions } from '@/hooks/useTransactions'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { TrendingUp, CreditCard, CheckCircle, BarChart3, AlertTriangle } from 'lucide-react'

export default function SuggestionsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'
  const navigate = useNavigate()

  const now = new Date()
  const { year, month } = useMonth()

  const { realSpending, income, savingsRate, transferTotal, spendingByCategory, transfers } = useTransactions(year, month)
  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const statements = useLiveQuery(() => db.statementUploads.toArray()) || []

  const creditAccounts = accounts.filter(a => a.type === 'credit')
  const highUtilCards = creditAccounts.filter(a => a.limit && ((a.balance || 0) / a.limit) > 0.3)

  // Build suggestions dynamically
  const suggestions = []

  // Category leakage
  const sortedCats = Object.entries(spendingByCategory).sort((a, b) => b[1].total - a[1].total)
  if (sortedCats.length > 0) {
    const topCat = sortedCats[0]
    const pct = realSpending > 0 ? (topCat[1].total / realSpending) * 100 : 0
    suggestions.push({
      icon: TrendingUp,
      color: 'amber',
      label: 'Spending Alert',
      title: `${topCat[0]} is your top category at ${formatCurrency(topCat[1].total)}`,
      desc: `This accounts for ${pct.toFixed(0)}% of your total real spending this month (${topCat[1].count} transactions).`,
    })
  }

  // Subscription count
  const subTotal = spendingByCategory['Subscriptions']?.total || 0
  const subCount = spendingByCategory['Subscriptions']?.count || 0
  if (subCount > 0) {
    suggestions.push({
      icon: BarChart3,
      color: 'violet',
      label: 'Subscription Audit',
      title: `${subCount} active subscriptions — ${formatCurrency(subTotal)}/month`,
      desc: `You're spending ${formatCurrency(subTotal * 12)} per year on subscriptions. Review each to see if they're still worth it.`,
    })
  }

  // High utilization
  for (const card of highUtilCards) {
    const util = ((card.balance || 0) / card.limit * 100).toFixed(0)
    const payDown = (card.balance || 0) - card.limit * 0.3
    suggestions.push({
      icon: CreditCard,
      color: 'red',
      label: 'Credit Alert',
      title: `${card.name} at ${util}% utilization — pay this down first`,
      desc: `High utilization on individual cards hurts your credit score. Paying ${formatCurrency(payDown)} would bring it under 30%.`,
    })
  }

  // Transfer confirmation
  if (transfers.length > 0) {
    suggestions.push({
      icon: CheckCircle,
      color: 'emerald',
      label: 'Transfer Verified',
      title: `${formatCurrency(transferTotal)} in card payments correctly excluded from spending`,
      desc: `Without transfer detection, your spending would appear ${realSpending > 0 ? ((transferTotal / realSpending) * 100).toFixed(0) : 0}% higher than reality. All ${transfers.length} transfers matched.`,
    })
  }

  // Missing statements
  const currentMonth = now.getMonth() + 1
  const months = Array.from({ length: currentMonth }, (_, i) => i + 1)
  const statementSet = new Set(statements.map(s => `${s.accountId}-${s.year}-${s.month}`))
  const missingCount = accounts.reduce((sum, a) => {
    return sum + months.filter(m => !statementSet.has(`${a.id}-${year}-${m}`)).length
  }, 0)

  if (missingCount > 0) {
    suggestions.push({
      icon: AlertTriangle,
      color: 'slate',
      label: 'Data Quality',
      title: `${missingCount} statement${missingCount !== 1 ? 's' : ''} missing — totals may be incomplete`,
      desc: `Without these statements, recurring detection and category totals are unreliable.`,
      action: { label: 'Upload Missing Statements', onClick: () => navigate('/upload') },
    })
  }

  const colorMap = {
    amber: { border: 'border-l-amber-500', bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50', text: 'text-amber-400' },
    violet: { border: 'border-l-violet-500', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50', text: 'text-violet-400' },
    red: { border: 'border-l-red-500', bg: isDark ? 'bg-red-500/10' : 'bg-red-50', text: 'text-red-400' },
    emerald: { border: 'border-l-emerald-500', bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', text: 'text-emerald-400' },
    blue: { border: 'border-l-blue-500', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', text: 'text-blue-400' },
    slate: { border: 'border-l-slate-500', bg: isDark ? 'bg-white/5' : 'bg-slate-50', text: isDark ? 'text-slate-400' : 'text-slate-500' },
  }

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Suggestions" title="AI Suggestions">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-brand-secondary/10 text-brand-secondary' : 'bg-blue-50 text-blue-600'}`}>
          {suggestions.length} insight{suggestions.length !== 1 ? 's' : ''}
        </div>
      </PageHeader>

      <div className="p-6 space-y-4">
        {suggestions.length > 0 ? (
          suggestions.map((s, i) => {
            const c = colorMap[s.color] || colorMap.slate
            const Icon = s.icon
            return (
              <Card key={i} className={`p-5 border-l-4 ${c.border}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <div className="flex-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{s.label}</span>
                    <p className={`text-sm font-medium mt-1 ${textMain}`}>{s.title}</p>
                    <p className={`text-xs mt-1 ${textMuted}`}>{s.desc}</p>
                    {s.action && (
                      <button
                        onClick={s.action.onClick}
                        className="mt-2 px-3 py-1.5 bg-brand-primary/20 text-brand-secondary rounded-lg text-xs font-medium cursor-pointer hover:bg-brand-primary/30 transition-colors"
                      >
                        {s.action.label}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        ) : (
          <Card className="p-8 text-center">
            <p className={`text-sm ${textDim}`}>Upload statements to generate personalized insights.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

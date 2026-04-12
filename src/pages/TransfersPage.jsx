import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import { useClaude } from '@/hooks/useClaude'
import { transactionsRepo } from '@/db/transactions'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatCurrencyFull, formatDate } from '@/lib/formatters'
import { ArrowLeftRight, ShoppingBag, Gift, HelpCircle, Sparkles } from 'lucide-react'

export default function TransfersPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { year, month } = useMonth()
  const [filter, setFilter] = useState('all')
  const { categorizeUnknowns, loading: aiLoading } = useClaude()

  const { transactions, realSpending, grossOutgoing, transferTotal } = useTransactions(year, month)

  const needsReview = transactions.filter(t => !t.isTransfer && !t.isIncome && !t.category)

  const filtered = transactions.filter(t => {
    if (filter === 'spending') return !t.isTransfer && !t.isIncome && t.direction === 'debit'
    if (filter === 'transfers') return t.isTransfer
    if (filter === 'review') return !t.isTransfer && !t.isIncome && !t.category
    return true
  })

  const handleClassify = async (txnId, type) => {
    if (type === 'transfer') {
      await transactionsRepo.update(txnId, { isTransfer: true, category: 'Transfer' })
    } else {
      await transactionsRepo.update(txnId, { isTransfer: false, category: 'Other' })
    }
  }

  function getIcon(t) {
    if (t.isTransfer) return <ArrowLeftRight className="w-4 h-4 text-amber-400" />
    if (t.isIncome) return <Gift className="w-4 h-4 text-emerald-400" />
    if (!t.category) return <HelpCircle className="w-4 h-4 text-amber-400" />
    return <ShoppingBag className="w-4 h-4 text-red-400" />
  }

  function getBadge(t) {
    if (t.isTransfer) return <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase">Transfer</span>
    if (t.isIncome) return <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">Income</span>
    if (!t.category) return <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase ring-1 ring-amber-500/30">Uncategorized</span>
    return <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">{t.category}</span>
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'spending', label: 'Spending' },
    { key: 'transfers', label: 'Transfers' },
    { key: 'review', label: `Uncategorized (${needsReview.length})`, highlight: needsReview.length > 0 },
  ]

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Transfers vs Spending" title="Transfers vs Spending">
        <MonthSelector />
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Reconciliation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 text-center">
            <p className={`text-xs uppercase tracking-wider mb-2 ${textMuted}`}>Gross Outgoing</p>
            <p className={`text-2xl font-bold font-mono ${textMain}`}>{formatCurrency(grossOutgoing)}</p>
          </Card>
          <Card className="p-5 text-center">
            <p className={`text-xs uppercase tracking-wider mb-2 ${textMuted}`}>Transfers</p>
            <p className="text-2xl font-bold font-mono text-amber-400">-{formatCurrency(transferTotal)}</p>
          </Card>
          <Card className="p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
            <p className={`text-xs uppercase tracking-wider mb-2 relative ${textMuted}`}>Real Spending</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 relative">{formatCurrency(realSpending)}</p>
          </Card>
        </div>

        {/* Transaction List */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <h3 className={`font-semibold text-sm ${textMain}`}>
              All Transactions — {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric'})}
            </h3>
            <div className="flex gap-2 items-center">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 text-xs rounded-md font-medium cursor-pointer ${
                    filter === f.key
                      ? 'bg-brand-primary/20 text-brand-secondary'
                      : f.highlight
                        ? 'text-amber-400 hover:bg-amber-500/10'
                        : `${textDim} hover:bg-white/5`
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {needsReview.length > 0 && (
                <button
                  onClick={() => categorizeUnknowns(needsReview)}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-3 py-1 text-xs rounded-md font-medium cursor-pointer bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiLoading ? 'Categorizing...' : 'AI Categorize'}
                </button>
              )}
            </div>
          </div>

          <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
            {filtered.length === 0 ? (
              <div className={`px-5 py-8 text-center ${textDim}`}>
                <p className="text-sm">No transactions found. Upload a statement to get started.</p>
              </div>
            ) : (
              filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => (
                <div
                  key={t.id}
                  className={`px-5 py-3 flex items-center gap-4 ${!t.category && !t.isTransfer && !t.isIncome ? (isDark ? 'bg-amber-500/[0.02]' : 'bg-amber-50/50') : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    t.isTransfer ? 'bg-amber-500/10' :
                    t.isIncome ? 'bg-emerald-500/10' :
                    !t.category ? 'bg-amber-500/10 ring-2 ring-amber-500/30' :
                    'bg-red-500/10'
                  }`}>
                    {getIcon(t)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${textMain}`}>{t.description}</p>
                    <p className={`text-xs ${textDim}`}>{formatDate(t.date)}</p>
                  </div>
                  {getBadge(t)}
                  <span className={`font-mono text-sm font-semibold ${
                    t.isTransfer ? `${textDim} line-through` :
                    t.isIncome ? 'text-emerald-400' :
                    textMain
                  }`}>
                    {t.direction === 'credit' ? '+' : '-'}{formatCurrencyFull(t.amount)}
                  </span>
                  {!t.category && !t.isTransfer && !t.isIncome && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleClassify(t.id, 'spending')}
                        className="px-2 py-1 text-[10px] rounded bg-brand-accent/20 text-emerald-400 font-medium cursor-pointer hover:bg-brand-accent/30"
                      >
                        Spending
                      </button>
                      <button
                        onClick={() => handleClassify(t.id, 'transfer')}
                        className="px-2 py-1 text-[10px] rounded bg-amber-500/20 text-amber-400 font-medium cursor-pointer hover:bg-amber-500/30"
                      >
                        Transfer
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

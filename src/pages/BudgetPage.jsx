import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { budgetsRepo } from '@/db/budgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency } from '@/lib/formatters'
import { Target, Plus, X, AlertTriangle } from 'lucide-react'

const ALL_CATEGORIES = [
  'Groceries', 'Dining', 'Bills & Utilities', 'Subscriptions',
  'Gas & Transport', 'Shopping', 'Health', 'International Transfers', 'Other',
]

export default function BudgetPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { year, month } = useMonth()
  const { spendingByCategory, realSpending } = useTransactions(year, month)
  const budgets = useLiveQuery(() => db.budgets.toArray()) || []

  const [showAdd, setShowAdd] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newLimit, setNewLimit] = useState('')

  const budgetedCategories = new Set(budgets.map(b => b.category))
  const availableCategories = ALL_CATEGORIES.filter(c => !budgetedCategories.has(c))

  const totalBudget = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const overBudgetCount = budgets.filter(b => {
    const spent = spendingByCategory[b.category]?.total || 0
    return spent > b.monthlyLimit
  }).length

  const handleAdd = async () => {
    if (!newCategory || !newLimit) return
    await budgetsRepo.set(newCategory, parseFloat(newLimit))
    setNewCategory('')
    setNewLimit('')
    setShowAdd(false)
  }

  const handleRemove = async (category) => {
    await budgetsRepo.deleteByCategory(category)
  }

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Budgets" title="Budget Caps">
        <MonthSelector />
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Total Budget</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${textMain}`}>{formatCurrency(totalBudget)}</p>
          </Card>
          <Card className="p-5">
            <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Spent</span>
            <p className={`text-2xl font-bold font-mono mt-2 ${realSpending > totalBudget && totalBudget > 0 ? 'text-red-400' : textMain}`}>
              {formatCurrency(realSpending)}
            </p>
          </Card>
          <Card className="p-5">
            <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Over Budget</span>
            <p className={`text-2xl font-bold font-mono mt-2 ${overBudgetCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {overBudgetCount} categor{overBudgetCount !== 1 ? 'ies' : 'y'}
            </p>
          </Card>
        </div>

        {/* Budget items */}
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = spendingByCategory[budget.category]?.total || 0
            const pct = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0
            const isOver = spent > budget.monthlyLimit
            const remaining = budget.monthlyLimit - spent

            return (
              <Card key={budget.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className={`font-semibold text-sm ${textMain}`}>{budget.category}</h4>
                    {isOver && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] font-bold text-red-400 uppercase">Over budget</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm ${textMain}`}>
                      {formatCurrency(spent)} / {formatCurrency(budget.monthlyLimit)}
                    </span>
                    <button
                      onClick={() => handleRemove(budget.category)}
                      className={`p-1 rounded hover:bg-red-500/10 cursor-pointer transition-colors ${textDim}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className={`h-3 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className={`text-xs ${textDim}`}>{pct.toFixed(0)}% used</span>
                  <span className={`text-xs font-mono ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isOver ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Add budget */}
        {showAdd ? (
          <Card className="p-5">
            <h4 className={`font-semibold text-sm mb-4 ${textMain}`}>Add Budget Cap</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              >
                <option value="">Select category</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className={`absolute left-3 top-2 text-sm ${textMuted}`}>$</span>
                <input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="Monthly limit"
                  className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!newCategory || !newLimit}
                className="px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-colors ${
              isDark ? 'border-white/10 text-slate-400 hover:border-brand-secondary/50 hover:text-brand-secondary' : 'border-slate-200 text-slate-400 hover:border-brand-secondary/50 hover:text-brand-secondary'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Budget Cap
          </button>
        )}
      </div>
    </div>
  )
}

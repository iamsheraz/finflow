import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTransactions } from '@/hooks/useTransactions'
import { useRecurring } from '@/hooks/useRecurring'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatPercent, CATEGORY_COLORS, CATEGORY_HEX } from '@/lib/formatters'
import { TrendingDown, TrendingUp, Gift, BarChart3, CircleDollarSign, RefreshCw, CheckCheck, Eye, Wallet, CreditCard, ArrowDownLeft, ArrowUpRight, Landmark, ArrowRightLeft, Info } from 'lucide-react'

export default function Overview() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { year, month } = useMonth()

  const { realSpending, income, savingsRate, grossOutgoing, transferTotal, spendingByCategory, transfers, needsReview, cashFlow } = useTransactions(year, month)
  const { recurring, totalMonthly, count: recurringCount } = useRecurring()

  // Previous month for comparison
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prev = useTransactions(prevYear, prevMonth)

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const creditAccounts = accounts.filter(a => a.type === 'credit')

  // Sort categories by amount
  const sortedCategories = Object.entries(spendingByCategory)
    .sort((a, b) => b[1].total - a[1].total)

  const maxCategoryTotal = sortedCategories.length > 0 ? sortedCategories[0][1].total : 1

  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Overview" title="Monthly Overview">
        <MonthSelector />
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Row 1: Cash Flow — what actually moved in/out of your bank */}
        <div>
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textDim}`}>Cash Flow — What moved in and out of your bank</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Cash In"
              tooltip="Income and deposits into your bank accounts"
              value={formatCurrency(cashFlow.cashIn)}
              icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10"
              current={cashFlow.cashIn}
              previous={prev.cashFlow?.cashIn}
              textMain={textMain}
              textMuted={textMuted}
            />
            <MetricCard
              label="Cash Out"
              tooltip="Debit purchases + credit card payments — actual money leaving your bank"
              value={formatCurrency(cashFlow.cashOut)}
              icon={<ArrowUpRight className="w-4 h-4 text-red-400" />}
              iconBg="bg-red-500/10"
              current={cashFlow.cashOut}
              previous={prev.cashFlow?.cashOut}
              invertColor
              textMain={textMain}
              textMuted={textMuted}
              subtitle={`${formatCurrency(cashFlow.debitSpending)} spent + ${formatCurrency(cashFlow.creditPayments)} card payments`}
            />
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>Net Cash Flow<Hint text="Cash In minus Cash Out — did your bank balance go up or down?" /></span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cashFlow.netCashFlow >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <Wallet className={`w-4 h-4 ${cashFlow.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono ${cashFlow.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cashFlow.netCashFlow >= 0 ? '+' : '-'}{formatCurrency(Math.abs(cashFlow.netCashFlow))}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs font-medium ${textDim}`}>
                  {cashFlow.netCashFlow >= 0 ? 'Bank balance grew' : 'Bank balance dropped'}
                </span>
              </div>
            </Card>
            <MetricCard
              label="Savings Rate"
              tooltip="Percentage of income kept — Net Cash Flow divided by Cash In"
              value={formatPercent(cashFlow.cashSavingsRate)}
              icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
              iconBg="bg-brand-secondary/10"
              current={cashFlow.cashSavingsRate}
              previous={prev.cashFlow?.cashSavingsRate}
              textMain={textMain}
              textMuted={textMuted}
              subtitle="Based on actual cash flow"
            />
          </div>
        </div>

        {/* Row 2: Spending Breakdown — debit vs credit */}
        <div>
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textDim}`}>Spending Breakdown — Debit vs Credit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>Debit Spending<Hint text="Purchases made directly from your checking/debit account" /></span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono ${textMain}`}>{formatCurrency(cashFlow.debitSpending)}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs font-medium ${textDim}`}>Direct bank purchases</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>Credit Spending<Hint text="Charges on your credit cards — a future liability, not cash out yet" /></span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono text-blue-400`}>{formatCurrency(cashFlow.creditSpending)}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs font-medium ${textDim}`}>Charged to credit cards</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>Card Payments<Hint text="Money you sent from your bank to pay off credit card bills" /></span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono text-amber-400`}>{formatCurrency(cashFlow.creditPayments)}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs font-medium ${textDim}`}>Paid toward credit cards</span>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>Credit Delta<Hint text="Credit spending minus card payments — negative means you're paying down debt" /></span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cashFlow.creditDelta <= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <TrendingDown className={`w-4 h-4 ${cashFlow.creditDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold font-mono ${cashFlow.creditDelta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cashFlow.creditDelta <= 0 ? '-' : '+'}{formatCurrency(Math.abs(cashFlow.creditDelta))}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-xs font-medium ${cashFlow.creditDelta <= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {cashFlow.creditDelta <= 0 ? 'Paying down debt' : 'Debt growing'}
                </span>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spending by Category */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-semibold ${textMain}`}>Spending by Category</h3>
            </div>
            {sortedCategories.length > 0 ? (
              <div className="flex items-end gap-3 h-48 px-2">
                {sortedCategories.map(([cat, data]) => {
                  const heightPct = (data.total / maxCategoryTotal) * 100
                  const color = CATEGORY_HEX[cat] || '#64748B'
                  return (
                    <div key={cat} className="flex-1 flex flex-col items-center gap-1 h-full">
                      <span className={`text-[10px] font-mono font-medium ${textMuted}`}>{formatCurrency(data.total)}</span>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t-md chart-bar"
                          style={{ height: `${heightPct}%`, backgroundColor: color, minHeight: '4px' }}
                        />
                      </div>
                      <span className={`text-[10px] mt-1 ${textDim}`}>{cat.split(' ')[0].slice(0, 6)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`flex items-center justify-center h-48 ${textDim}`}>
                <p className="text-sm">Upload a statement to see spending breakdown</p>
              </div>
            )}
          </Card>

          {/* Transfer Summary + Trust */}
          {/* Transfer Summary */}
          <Card className="p-6">
            <h3 className={`font-semibold mb-4 ${textMain}`}>Transfer Detection</h3>
            <div className="space-y-4">
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <span className={`text-sm ${textMuted}`}>Gross Outgoing</span>
                <span className={`font-mono font-semibold text-sm ${textMain}`}>{formatCurrency(grossOutgoing)}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className={`text-sm ${textMuted}`}>Transfers Excluded</span>
                </div>
                <span className="font-mono font-semibold text-sm text-amber-400">-{formatCurrency(transferTotal)}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className={`text-sm font-medium ${textMain}`}>Real Spending</span>
                </div>
                <span className="font-mono font-bold text-sm text-emerald-400">{formatCurrency(realSpending)}</span>
              </div>

              {transfers.length > 0 && (
                <div className={`mt-3 p-3 rounded-lg border ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className={`text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      {transfers.length} card payments correctly identified as transfers
                    </p>
                  </div>
                </div>
              )}

              {needsReview.length > 0 && (
                <button
                  onClick={() => navigate('/transfers')}
                  className={`mt-1 w-full p-3 rounded-lg border text-left cursor-pointer transition-colors ${isDark ? 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                        {needsReview.length} uncategorized — click to classify
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Utilization Snapshot */}
        {creditAccounts.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${textMain}`}>Credit Utilization — Top 5</h3>
              <button onClick={() => navigate('/utilization')} className="text-xs text-brand-secondary hover:underline cursor-pointer">View all cards</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {creditAccounts.slice(0, 5).map(account => {
                const util = account.limit ? ((account.balance || 0) / account.limit) * 100 : 0
                const color = util < 20 ? 'emerald' : util < 30 ? 'amber' : 'red'
                return (
                  <div key={account.id} className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className={textMuted}>{account.name}</span>
                      <span className={`text-${color}-400 font-mono`}>{util.toFixed(0)}%</span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div className={`h-full rounded-full bg-${color}-500 util-bar`} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                    <p className={`text-[10px] font-mono ${textDim}`}>
                      {formatCurrency(account.balance || 0)} / {formatCurrency(account.limit || 0)}
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Recurring Snapshot */}
        {recurringCount > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${textMain}`}>Recurring — {formatCurrency(totalMonthly)}/mo</h3>
              <button onClick={() => navigate('/recurring')} className="text-xs text-brand-secondary hover:underline cursor-pointer">View all</button>
            </div>
            <div className="space-y-3">
              {recurring.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${textMain}`}>{item.merchant}</p>
                      <p className={`text-[10px] ${textDim}`}>{item.category || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-semibold ${textMain}`}>{formatCurrency(item.monthlyEstimate)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Empty state */}
        {realSpending === 0 && income === 0 && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-brand-secondary" />
            </div>
            <h3 className={`text-lg font-semibold mb-1 ${textMain}`}>No data yet</h3>
            <p className={`text-sm mb-4 ${textMuted}`}>Upload your first bank or credit card statement to get started.</p>
            <button
              onClick={() => navigate('/upload')}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              Upload Statement
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}

function Upload(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}

function Hint({ text }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help">
      <Info className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-[11px] text-slate-200 font-normal normal-case tracking-normal whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  )
}

function MetricCard({ label, value, icon, iconBg, current, previous, invertColor, textMain, textMuted, subtitle, tooltip }) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
  const isUp = change > 0
  const isSignificant = Math.abs(change) >= 1

  // For spending, up is bad (red). For income/savings, up is good (green).
  const changeColor = !isSignificant
    ? 'text-slate-400'
    : invertColor
      ? (isUp ? 'text-red-400' : 'text-emerald-400')
      : (isUp ? 'text-emerald-400' : 'text-red-400')

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium uppercase tracking-wider ${textMuted} flex items-center`}>{label}{tooltip && <Hint text={tooltip} />}</span>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${textMain}`}>{value}</p>
      <div className="flex items-center gap-1 mt-1.5">
        {isSignificant ? (
          <>
            {isUp ? (
              <TrendingUp className={`w-3.5 h-3.5 ${changeColor}`} />
            ) : (
              <TrendingDown className={`w-3.5 h-3.5 ${changeColor}`} />
            )}
            <span className={`text-xs font-medium ${changeColor}`}>
              {isUp ? '+' : ''}{change.toFixed(1)}% vs last month
            </span>
          </>
        ) : (
          <span className={`text-xs font-medium ${changeColor}`}>
            {previous > 0 ? 'Stable vs last month' : 'No prior data'}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>
      )}
    </Card>
  )
}

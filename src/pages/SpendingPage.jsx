import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useTheme } from '@/hooks/useTheme'
import { useMonth } from '@/hooks/useMonth'
import { transactionsRepo } from '@/db/transactions'
import PageHeader from '@/components/Layout/PageHeader'
import MonthSelector from '@/components/Layout/MonthSelector'
import Card from '@/components/Layout/Card'
import { formatCurrency, formatCurrencyFull, formatDate, CATEGORY_COLORS } from '@/lib/formatters'
import {
  ChevronRight, ShoppingCart, UtensilsCrossed, Zap, Tv, Fuel,
  ShoppingBag, Heart, Globe, CheckCircle, CircleAlert, CircleCheck,
  CheckCheck, Eye,
} from 'lucide-react'

const CATEGORY_ICONS = {
  'Groceries': ShoppingCart,
  'Dining': UtensilsCrossed,
  'Bills & Utilities': Zap,
  'Subscriptions': Tv,
  'Gas & Transport': Fuel,
  'Shopping': ShoppingBag,
  'Health': Heart,
  'International Transfers': Globe,
}

export default function SpendingPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const { year, month } = useMonth()
  const [level, setLevel] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedMerchant, setSelectedMerchant] = useState(null)

  const { transactions, realSpending, spendingByCategory } = useTransactions(year, month)

  // All spending transactions (not transfers, not income)
  const allSpending = transactions.filter(t => !t.isTransfer && !t.isIncome && t.direction === 'debit')

  const sortedCategories = Object.entries(spendingByCategory).sort((a, b) => b[1].total - a[1].total)
  const totalCount = allSpending.length

  // Verification stats
  const verifiedTotal = allSpending.filter(t => t.verified).length
  const unverifiedTotal = totalCount - verifiedTotal
  const verifiedPct = totalCount > 0 ? (verifiedTotal / totalCount) * 100 : 100

  // Uncategorized (system doesn't know what they are)
  const uncategorized = allSpending.filter(t => !t.category)

  // Needs attention (user flagged as unverified) — only categorized ones that aren't verified
  const needsAttention = allSpending.filter(t => t.category && t.verified === false)

  // Per-category verification counts
  function getCategoryVerification(cat) {
    const txns = allSpending.filter(t => t.category === cat)
    const verified = txns.filter(t => t.verified).length
    return { verified, total: txns.length, allVerified: verified === txns.length, txns }
  }

  // Level 2: merchants in a category
  const categoryTxns = allSpending.filter(t => t.category === selectedCategory)
  const merchantGroups = {}
  for (const t of categoryTxns) {
    const m = t.merchant || t.description
    if (!merchantGroups[m]) merchantGroups[m] = { total: 0, count: 0, transactions: [], verified: 0 }
    merchantGroups[m].total += Math.abs(t.amount)
    merchantGroups[m].count++
    merchantGroups[m].transactions.push(t)
    if (t.verified) merchantGroups[m].verified++
  }
  const sortedMerchants = Object.entries(merchantGroups).sort((a, b) => b[1].total - a[1].total)

  // Level 3: transactions for a merchant — unverified sort to top
  const merchantTxns = selectedMerchant
    ? (merchantGroups[selectedMerchant]?.transactions || []).sort((a, b) => {
        if (a.verified === b.verified) return new Date(b.date) - new Date(a.date)
        return a.verified ? 1 : -1 // unverified first
      })
    : []

  const toggleVerify = async (id, current) => {
    await transactionsRepo.setVerified(id, !current)
  }

  const verifyAllInCategory = async (cat) => {
    const ids = allSpending.filter(t => t.category === cat && !t.verified).map(t => t.id)
    if (ids.length > 0) await transactionsRepo.bulkSetVerified(ids, true)
  }

  const verifyAllInMerchant = async (merchant) => {
    const txns = merchantGroups[merchant]?.transactions || []
    const ids = txns.filter(t => !t.verified).map(t => t.id)
    if (ids.length > 0) await transactionsRepo.bulkSetVerified(ids, true)
  }

  const breadcrumbParts = []
  if (level >= 2) breadcrumbParts.push({ label: selectedCategory, onClick: () => { setLevel(2); setSelectedMerchant(null) } })
  if (level >= 3) breadcrumbParts.push({ label: selectedMerchant })

  const title = level === 1 ? 'Spending Breakdown' : level === 2 ? selectedCategory : selectedMerchant

  return (
    <div className="fade-in">
      <div className={`px-6 py-4 border-b ${isDark ? 'border-brand-border' : 'border-slate-200'}`}>
        <div className={`flex items-center gap-2 text-xs mb-1 ${textDim}`}>
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3" />
          <span
            className={`${level > 1 ? 'cursor-pointer hover:text-brand-secondary' : ''} ${isDark ? 'text-white' : 'text-slate-900'}`}
            onClick={() => { setLevel(1); setSelectedCategory(null); setSelectedMerchant(null) }}
          >
            Spending
          </span>
          {breadcrumbParts.map((part, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              <span
                className={`${part.onClick ? 'cursor-pointer hover:text-brand-secondary' : ''} ${isDark ? 'text-white' : 'text-slate-900'}`}
                onClick={part.onClick}
              >
                {part.label}
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h2 className={`text-xl font-bold ${textMain}`}>{title}</h2>
          <MonthSelector />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ==================== LEVEL 1: Categories ==================== */}
        {level === 1 && (
          <>
            {/* Summary Bar */}
            <Card className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-wider ${textMuted}`}>Total Real Spending</p>
                <p className={`text-3xl font-bold font-mono mt-1 ${textMain}`}>{formatCurrency(realSpending)}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className={`text-lg font-bold font-mono ${textMain}`}>{totalCount}</p>
                  <p className={`text-[10px] uppercase ${textMuted}`}>Transactions</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold font-mono ${textMain}`}>{sortedCategories.length}</p>
                  <p className={`text-[10px] uppercase ${textMuted}`}>Categories</p>
                </div>
                {/* Verification progress */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {verifiedPct === 100 ? (
                      <CheckCheck className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-amber-400" />
                    )}
                    <p className={`text-lg font-bold font-mono ${verifiedPct === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {verifiedTotal}/{totalCount}
                    </p>
                  </div>
                  <p className={`text-[10px] uppercase ${textMuted}`}>Reviewed</p>
                </div>
              </div>
            </Card>

            {/* Category Cards */}
            <div className="space-y-2">
              {sortedCategories.length === 0 && uncategorized.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className={`text-sm ${textDim}`}>No spending data yet. Upload a statement to see your breakdown.</p>
                </Card>
              ) : (
                sortedCategories.map(([cat, data]) => {
                  const Icon = CATEGORY_ICONS[cat] || ShoppingBag
                  const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']
                  const pct = realSpending > 0 ? (data.total / realSpending) * 100 : 0
                  const cv = getCategoryVerification(cat)

                  return (
                    <Card
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setLevel(2) }}
                      className="group"
                    >
                      <div className="p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-semibold text-sm ${textMain}`}>{cat}</h4>
                              {/* Verification badge */}
                              {cv.allVerified ? (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase">
                                  <CheckCheck className="w-2.5 h-2.5" /> Verified
                                </span>
                              ) : (
                                <span className={`text-[10px] font-mono ${textDim}`}>
                                  {cv.verified}/{cv.total} reviewed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs ${textMuted}`}>{data.count} transactions</span>
                              <span className={`font-mono font-bold text-sm ${textMain}`}>{formatCurrency(data.total)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`flex-1 h-2 rounded-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                              <div className={`h-full rounded-full ${colors.bg}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-mono w-10 text-right ${textMuted}`}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isDark ? 'text-slate-600 group-hover:text-brand-secondary' : 'text-slate-300 group-hover:text-brand-secondary'}`} />
                      </div>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Needs Attention — user-flagged unverified */}
            {needsAttention.length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${textMain}`}>
                  <CircleAlert className="w-4 h-4 text-amber-400" />
                  Needs Attention
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{needsAttention.length}</span>
                </h3>
                <Card className="overflow-hidden border-l-4 border-l-amber-500">
                  <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                    {needsAttention.map(t => (
                      <div key={t.id} className={`px-5 py-3 flex items-center gap-4 ${isDark ? 'bg-amber-500/[0.02]' : 'bg-amber-50/30'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleVerify(t.id, t.verified) }}
                          className="w-7 h-7 rounded-lg border-2 border-amber-500/40 flex items-center justify-center shrink-0 cursor-pointer hover:bg-amber-500/10 transition-colors"
                          title="Mark as verified"
                        >
                          <CircleAlert className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${textMain}`}>{t.description}</p>
                          <p className={`text-xs ${textDim}`}>{formatDate(t.date)} · {t.category}</p>
                        </div>
                        <span className={`font-mono text-sm font-semibold ${textMain}`}>-{formatCurrencyFull(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Uncategorized — system doesn't know */}
            {uncategorized.length > 0 && (
              <div>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${textMain}`}>
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                  Uncategorized
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{uncategorized.length}</span>
                </h3>
                <Card className={`overflow-hidden border-l-4 ${isDark ? 'border-l-slate-600' : 'border-l-slate-300'}`}>
                  <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                    {uncategorized.map(t => (
                      <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                          <ShoppingBag className={`w-3.5 h-3.5 ${textDim}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${textMain}`}>{t.description}</p>
                          <p className={`text-xs ${textDim}`}>{formatDate(t.date)}</p>
                        </div>
                        <span className={`font-mono text-sm font-semibold ${textMain}`}>-{formatCurrencyFull(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ==================== LEVEL 2: Merchants ==================== */}
        {level === 2 && (
          <>
            {/* Verify all button */}
            {categoryTxns.some(t => !t.verified) && (
              <div className="flex justify-end">
                <button
                  onClick={() => verifyAllInCategory(selectedCategory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Verify all in {selectedCategory}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {sortedMerchants.map(([merchant, data]) => {
                const allV = data.verified === data.count
                return (
                  <Card
                    key={merchant}
                    onClick={() => { setSelectedMerchant(merchant); setLevel(3) }}
                    className="group"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`font-semibold text-sm ${textMain}`}>{merchant}</h4>
                            {allV ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <span className={`text-[10px] font-mono ${textDim}`}>{data.verified}/{data.count}</span>
                            )}
                          </div>
                          <p className={`text-xs ${textDim}`}>{data.count} visit{data.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!allV && (
                          <button
                            onClick={(e) => { e.stopPropagation(); verifyAllInMerchant(merchant) }}
                            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                            title={`Verify all ${merchant} transactions`}
                          >
                            <CheckCheck className="w-4 h-4 text-emerald-400" />
                          </button>
                        )}
                        <span className={`font-mono font-bold text-sm ${textMain}`}>{formatCurrency(data.total)}</span>
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-600 group-hover:text-brand-secondary' : 'text-slate-300 group-hover:text-brand-secondary'}`} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* ==================== LEVEL 3: Transactions ==================== */}
        {level === 3 && (
          <>
            {/* Verify all button for this merchant */}
            {merchantTxns.some(t => !t.verified) && (
              <div className="flex justify-end">
                <button
                  onClick={() => verifyAllInMerchant(selectedMerchant)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Verify all
                </button>
              </div>
            )}

            <Card className="overflow-hidden">
              <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {merchantTxns.map(t => (
                  <div
                    key={t.id}
                    className={`px-5 py-3 flex items-center gap-4 transition-colors ${
                      !t.verified ? (isDark ? 'bg-amber-500/[0.02]' : 'bg-amber-50/30') : ''
                    }`}
                  >
                    {/* Verify toggle */}
                    <button
                      onClick={() => toggleVerify(t.id, t.verified)}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                        t.verified
                          ? 'border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : `${isDark ? 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/5' : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50'}`
                      }`}
                      title={t.verified ? 'Unverify' : 'Mark as verified'}
                    >
                      {t.verified ? (
                        <CircleCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${t.verified ? textMain : 'text-amber-400'}`}>{formatDate(t.date)}</p>
                      <p className={`text-xs ${textDim}`}>{t.description}</p>
                    </div>
                    <span className={`font-mono font-semibold text-sm ${textMain}`}>-{formatCurrencyFull(t.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

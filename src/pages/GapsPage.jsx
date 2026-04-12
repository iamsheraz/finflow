import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useTheme } from '@/hooks/useTheme'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { AlertTriangle } from 'lucide-react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function GapsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'
  const navigate = useNavigate()

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const statements = useLiveQuery(() => db.statementUploads.toArray()) || []

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Build coverage grid
  const statementSet = new Set(statements.map(s => `${s.accountId}-${s.year}-${s.month}`))
  const months = Array.from({ length: currentMonth }, (_, i) => i + 1)

  const gapCount = accounts.reduce((sum, a) => {
    return sum + months.filter(m => !statementSet.has(`${a.id}-${currentYear}-${m}`)).length
  }, 0)

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Gaps" title="Statement Gaps" />

      <div className="p-6 space-y-6">
        {gapCount > 0 && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                {gapCount} missing statement{gapCount !== 1 ? 's' : ''} detected
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                Missing months create blind spots in recurring detection and category totals.
              </p>
            </div>
          </div>
        )}

        {accounts.length > 0 ? (
          <Card className="p-6">
            <h3 className={`font-semibold mb-6 ${textMain}`}>{currentYear} Coverage</h3>

            {/* Header row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-40 shrink-0" />
              {months.map(m => (
                <div key={m} className={`w-10 h-6 flex items-center justify-center text-[10px] font-medium ${textDim}`}>
                  {MONTH_LABELS[m - 1]}
                </div>
              ))}
            </div>

            {/* Account rows */}
            <div className="space-y-2">
              {accounts.map(account => (
                <div key={account.id} className="flex items-center gap-2">
                  <div className={`w-40 shrink-0 text-sm font-medium truncate ${textMain}`}>{account.name}</div>
                  {months.map(m => {
                    const hasData = statementSet.has(`${account.id}-${currentYear}-${m}`)
                    return (
                      <div
                        key={m}
                        className={`w-10 h-10 rounded-md flex items-center justify-center text-[11px] font-medium cursor-pointer transition-colors ${
                          hasData
                            ? `${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`
                            : `${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'} hover:bg-red-500/30`
                        }`}
                        onClick={() => !hasData && navigate('/upload')}
                        title={hasData ? 'Uploaded' : 'Missing — click to upload'}
                      >
                        {MONTH_LABELS[m - 1][0]}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`} />
                <span className={`text-xs ${textMuted}`}>Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`} />
                <span className={`text-xs ${textMuted}`}>Missing</span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className={`text-sm ${textDim}`}>No accounts found. Upload your first statement to start tracking coverage.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { exportJSON, exportCSV, importJSON, clearAllData } from '@/lib/exportData'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { Download, Upload, Trash2, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle, Moon, Sun } from 'lucide-react'

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  const handleImport = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const result = await importJSON(file)
      setImportResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }, [])

  const handleClear = async () => {
    await clearAllData()
    setCleared(true)
    setConfirmClear(false)
    setTimeout(() => setCleared(false), 3000)
  }

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Settings" title="Settings" />

      <div className="p-6 space-y-6">
        {/* Appearance */}
        <Card className="p-6">
          <h3 className={`font-semibold mb-4 ${textMain}`}>Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${textMain}`}>Theme</p>
              <p className={`text-xs ${textDim}`}>Switch between dark and light mode</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
        </Card>

        {/* Export */}
        <Card className="p-6">
          <h3 className={`font-semibold mb-4 ${textMain}`}>Export Data</h3>
          <p className={`text-xs mb-4 ${textDim}`}>Your data, your control. Export everything as JSON backup or CSV transactions.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              <FileJson className="w-4 h-4" />
              Export JSON Backup
            </button>
            <button
              onClick={exportCSV}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Transactions CSV
            </button>
          </div>
        </Card>

        {/* Import */}
        <Card className="p-6">
          <h3 className={`font-semibold mb-4 ${textMain}`}>Import / Restore</h3>
          <p className={`text-xs mb-4 ${textDim}`}>Restore from a JSON backup file. This will replace all existing data.</p>

          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors w-fit ${
            isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
          }`}>
            <Upload className="w-4 h-4" />
            {importing ? 'Importing...' : 'Import JSON Backup'}
            <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={importing} />
          </label>

          {importResult && (
            <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200'}`}>
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className={`text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                Restored {importResult.accounts} accounts and {importResult.transactions} transactions.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 border-red-500/20">
          <h3 className="font-semibold mb-4 text-red-400">Danger Zone</h3>
          <p className={`text-xs mb-4 ${textDim}`}>Permanently delete all data. This cannot be undone. Export a backup first.</p>

          {confirmClear ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Yes, delete everything
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Data
            </button>
          )}

          {cleared && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">All data has been cleared.</p>
            </div>
          )}
        </Card>

        {/* About */}
        <Card className="p-6">
          <h3 className={`font-semibold mb-2 ${textMain}`}>About FinFlow</h3>
          <p className={`text-xs ${textDim}`}>
            Local-first personal finance manager. All data stays on your device.
            No bank credentials needed — just upload your statements.
          </p>
          <div className={`mt-3 flex items-center gap-1.5 px-2 py-1 rounded-md w-fit ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider">100% Local-First</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

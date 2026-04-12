import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { accountsRepo } from '@/db/accounts'
import { transactionsRepo } from '@/db/transactions'
import { statementsRepo } from '@/db/statements'
import { categoryRulesRepo } from '@/db/categoryRules'
import { parseCSV } from '@/lib/parser'
import { parsePDF } from '@/lib/pdfParser'
import { categorizeTransaction, categorizeFromRule } from '@/lib/categorizer'
import { detectTransferPairs } from '@/lib/transferDetector'
import { useTheme } from '@/hooks/useTheme'
import PageHeader from '@/components/Layout/PageHeader'
import Card from '@/components/Layout/Card'
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'

export default function UploadPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-slate-900'
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const textDim = isDark ? 'text-slate-500' : 'text-slate-400'

  const [dragOver, setDragOver] = useState(false)
  const [parseResults, setParseResults] = useState([]) // array of { file, result, error, accountName, showNamePrompt, imported, importing }
  const [error, setError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [importingAll, setImportingAll] = useState(false)

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const statements = useLiveQuery(() => db.statementUploads.toArray()) || []

  const handleFiles = useCallback(async (files) => {
    setError(null)
    setParsing(true)

    const validFiles = Array.from(files).filter(f => {
      const name = f.name.toLowerCase()
      return name.endsWith('.csv') || name.endsWith('.pdf')
    })

    if (validFiles.length === 0) {
      setError('No supported files found. Please upload CSV or PDF statements.')
      setParsing(false)
      return
    }

    if (validFiles.length < files.length) {
      setError(`${files.length - validFiles.length} file(s) skipped — only CSV and PDF are supported.`)
    }

    const results = []

    for (const file of validFiles) {
      const isPDF = file.name.toLowerCase().endsWith('.pdf')
      try {
        let result
        if (isPDF) {
          result = await parsePDF(file)
        } else {
          const text = await file.text()
          result = await parseCSV(text)
        }

        // Check if account exists
        let showNamePrompt = false
        const autoName = result.accountInfo.bank
          ? `${result.accountInfo.bank} ${result.accountInfo.type === 'credit' ? 'Card' : 'Checking'}`
          : ''
        let accountName = autoName

        if (result.accountInfo.last4) {
          const existing = await accountsRepo.getByLast4(result.accountInfo.last4)
          if (!existing) {
            showNamePrompt = true
          } else {
            accountName = existing.name // use existing account name
          }
        } else {
          showNamePrompt = true
        }

        results.push({
          file: file.name,
          result,
          error: null,
          accountName,
          showNamePrompt,
          imported: false,
          importing: false,
        })
      } catch (err) {
        results.push({
          file: file.name,
          result: null,
          error: err.message,
          accountName: '',
          showNamePrompt: false,
          imported: false,
          importing: false,
        })
      }
    }

    setParseResults(prev => [...prev, ...results])
    setParsing(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleFileInput = useCallback((e) => {
    if (e.target.files.length > 0) handleFiles(e.target.files)
    e.target.value = '' // allow re-uploading same files
  }, [handleFiles])

  const updateParseResult = (idx, updates) => {
    setParseResults(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r))
  }

  const handleImportSingle = async (idx) => {
    const entry = parseResults[idx]
    if (!entry?.result || entry.imported) return
    updateParseResult(idx, { importing: true })

    try {
      await importStatement(entry.result, entry.accountName)
      updateParseResult(idx, { imported: true, importing: false })
      window.dispatchEvent(new Event('finflow:data-imported'))
    } catch (err) {
      updateParseResult(idx, { error: err.message, importing: false })
    }
  }

  const handleImportAll = async () => {
    setImportingAll(true)
    const pending = parseResults.filter((r, i) => r.result && !r.imported && !r.error)

    for (let i = 0; i < parseResults.length; i++) {
      const entry = parseResults[i]
      if (!entry.result || entry.imported || entry.error) continue
      updateParseResult(i, { importing: true })
      try {
        await importStatement(entry.result, entry.accountName)
        updateParseResult(i, { imported: true, importing: false })
      } catch (err) {
        updateParseResult(i, { error: err.message, importing: false })
      }
    }

    window.dispatchEvent(new Event('finflow:data-imported'))
    setImportingAll(false)
  }

  const importStatement = async (parseResult, accountName) => {
    let accountId
    if (parseResult.accountInfo.last4) {
      const existing = await accountsRepo.getByLast4(parseResult.accountInfo.last4)
      if (existing) accountId = existing.id
    }

    if (!accountId) {
      accountId = await accountsRepo.create({
        name: accountName || `Account ****${parseResult.accountInfo.last4 || '????'}`,
        type: parseResult.accountInfo.type,
        last4: parseResult.accountInfo.last4 || '',
        limit: null,
        currency: 'USD',
      })
    }

    const userRules = await categoryRulesRepo.getAll()

    const categorized = parseResult.transactions.map(t => {
      const userCat = categorizeFromRule(t.description, userRules)
      if (userCat) return { ...t, accountId, category: userCat }

      const auto = categorizeTransaction(t.description, t.amount, t.direction)
      return {
        ...t,
        accountId,
        category: auto.category,
        isTransfer: auto.isTransfer,
        isIncome: auto.isIncome,
      }
    })

    await transactionsRepo.bulkAdd(categorized)

    const allTxns = await db.transactions.toArray()
    const pairs = detectTransferPairs(allTxns)
    for (const pair of pairs) {
      await transactionsRepo.update(pair.fromTxnId, { isTransfer: true, transferPairId: pair.id })
      await transactionsRepo.update(pair.toTxnId, { isTransfer: true, transferPairId: pair.id })
    }

    await statementsRepo.create({
      accountId,
      month: parseResult.statementInfo.month,
      year: parseResult.statementInfo.year,
    })
  }

  // Group statements by account
  const statementsByAccount = {}
  for (const s of statements) {
    if (!statementsByAccount[s.accountId]) statementsByAccount[s.accountId] = []
    statementsByAccount[s.accountId].push(s)
  }

  return (
    <div className="fade-in">
      <PageHeader breadcrumb="Upload Statements" title="Upload Statements" />

      <div className="p-6 space-y-6">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer group
            ${isDark ? 'bg-brand-card' : 'bg-white'}
            ${dragOver
              ? 'border-brand-secondary bg-brand-secondary/5'
              : isDark ? 'border-white/10 hover:border-brand-secondary/50' : 'border-slate-200 hover:border-brand-secondary/50'
            }
          `}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.pdf"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isDark ? 'bg-brand-primary/10' : 'bg-blue-50'}`}>
            <Upload className="w-8 h-8 text-brand-secondary" />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${textMain}`}>Drop your statements here</h3>
          <p className={`text-sm mb-4 ${textMuted}`}>CSV and PDF files supported — upload multiple at once</p>
          <button className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
            Browse Files
          </button>
          <p className={`text-[10px] mt-4 flex items-center justify-center gap-1 ${textDim}`}>
            <CheckCircle className="w-3 h-3" />
            Files are processed locally. Nothing leaves your device.
          </p>
        </div>

        {/* Parsing indicator */}
        {parsing && (
          <Card className="p-5 text-center">
            <div className="animate-spin w-8 h-8 mx-auto mb-3 border-2 border-brand-secondary border-t-transparent rounded-full" />
            <p className={`text-sm ${textMain}`}>Parsing statements...</p>
            <p className={`text-xs mt-1 ${textDim}`}>Extracting text and detecting transactions</p>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Import All button */}
        {parseResults.filter(r => r.result && !r.imported && !r.error).length > 1 && (
          <div className="flex justify-end">
            <button
              onClick={handleImportAll}
              disabled={importingAll}
              className="px-5 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
            >
              {importingAll ? 'Importing all...' : `Import All (${parseResults.filter(r => r.result && !r.imported && !r.error).length} files)`}
            </button>
          </div>
        )}

        {/* Parse Results — one card per file */}
        {parseResults.map((entry, idx) => (
          <Card key={idx} className="p-5">
            {entry.error && !entry.result ? (
              /* Parse error */
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className={`text-sm font-medium ${textMain}`}>{entry.file}</p>
                  <p className="text-xs text-red-400 mt-0.5">{entry.error}</p>
                </div>
              </div>
            ) : entry.imported ? (
              /* Imported successfully */
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {entry.file} — {entry.result.statementInfo.transactionCount} transactions imported
                  </p>
                  <p className={`text-xs mt-0.5 ${textDim}`}>
                    {entry.result.accountInfo.bank || 'Account'} {entry.result.accountInfo.last4 ? `****${entry.result.accountInfo.last4}` : ''}
                    {' · '}{new Date(entry.result.statementInfo.year, entry.result.statementInfo.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ) : entry.result ? (
              /* Parsed, ready to import */
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-brand-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm truncate ${textMain}`}>
                      {entry.file} — {entry.result.accountInfo.bank || 'Unknown Bank'} {entry.result.accountInfo.type === 'credit' ? 'Card' : 'Account'}
                    </h4>
                    <p className={`text-xs ${textMuted}`}>
                      {entry.result.accountInfo.type} {entry.result.accountInfo.last4 ? `ending in ${entry.result.accountInfo.last4}` : ''}
                      {' · '}{entry.result.statementInfo.transactionCount} transactions
                      {' · '}{new Date(entry.result.statementInfo.year, entry.result.statementInfo.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {entry.showNamePrompt && (
                  <div className={`mb-3 p-3 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <label className={`text-xs font-medium ${textMuted}`}>Name this account:</label>
                    <input
                      type="text"
                      value={entry.accountName}
                      onChange={(e) => updateParseResult(idx, { accountName: e.target.value })}
                      placeholder="e.g., Chase Sapphire Reserve"
                      className={`mt-1.5 w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    />
                  </div>
                )}

                {entry.error && (
                  <p className="text-xs text-red-400 mb-2">{entry.error}</p>
                )}

                <button
                  onClick={() => handleImportSingle(idx)}
                  disabled={entry.importing}
                  className="px-4 py-1.5 bg-brand-accent text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {entry.importing ? 'Importing...' : 'Import'}
                </button>
              </>
            ) : null}
          </Card>
        ))}

        {/* Upload History */}
        {accounts.length > 0 && (
          <Card className="overflow-hidden">
            <div className={`px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
              <h3 className={`font-semibold text-sm ${textMain}`}>Upload History</h3>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
              {accounts.map(account => {
                const acctStatements = statementsByAccount[account.id] || []
                const initials = account.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                const colorMap = { credit: 'blue', debit: 'emerald', paypal: 'amber' }
                const color = colorMap[account.type] || 'blue'

                return (
                  <div key={account.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                        <span className={`text-xs font-bold text-${color}-400`}>{initials}</span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${textMain}`}>{account.name}</p>
                        <p className={`text-xs ${textDim}`}>{account.type} {account.last4 ? `· ****${account.last4}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${textMuted}`}>
                        {acctStatements.length} statement{acctStatements.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-1 mt-1 justify-end">
                        {acctStatements.map((s, i) => (
                          <div key={i} className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
                            <span className="text-[8px] text-emerald-400 font-bold">
                              {['J','F','M','A','M','J','J','A','S','O','N','D'][s.month - 1]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

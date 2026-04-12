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
import { Upload, CheckCircle, AlertCircle, FileText, Trash2, X } from 'lucide-react'

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
          accountType: result.accountInfo.type, // editable before import
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
      await importStatement(entry.result, entry.accountName, entry.accountType)
      updateParseResult(idx, { imported: true, importing: false })
      window.dispatchEvent(new Event('finflow:data-imported'))
    } catch (err) {
      updateParseResult(idx, { error: err.message, importing: false })
    }
  }

  const handleImportAll = async () => {
    setImportingAll(true)

    for (let i = 0; i < parseResults.length; i++) {
      const entry = parseResults[i]
      if (!entry.result || entry.imported || entry.error) continue
      updateParseResult(i, { importing: true })
      try {
        await importStatement(entry.result, entry.accountName, entry.accountType)
        updateParseResult(i, { imported: true, importing: false })
      } catch (err) {
        updateParseResult(i, { error: err.message, importing: false })
      }
    }

    window.dispatchEvent(new Event('finflow:data-imported'))
    setImportingAll(false)
  }

  const importStatement = async (parseResult, accountName, accountType) => {
    const finalType = accountType || parseResult.accountInfo.type
    let accountId
    if (parseResult.accountInfo.last4) {
      const existing = await accountsRepo.getByLast4(parseResult.accountInfo.last4)
      if (existing) {
        accountId = existing.id
        // Update balance/limit and type if we extracted them from this statement
        const updates = { type: finalType }
        if (parseResult.accountInfo.balance != null) updates.balance = parseResult.accountInfo.balance
        if (parseResult.accountInfo.creditLimit != null) updates.limit = parseResult.accountInfo.creditLimit
        await accountsRepo.update(accountId, updates)
      }
    }

    if (!accountId) {
      accountId = await accountsRepo.create({
        name: accountName || `Account ****${parseResult.accountInfo.last4 || '????'}`,
        type: finalType,
        last4: parseResult.accountInfo.last4 || '',
        balance: parseResult.accountInfo.balance || null,
        limit: parseResult.accountInfo.creditLimit || null,
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

  // Delete entire account + all its transactions + statement records
  const handleDeleteAccount = async (accountId) => {
    const txns = await db.transactions.where('accountId').equals(accountId).toArray()
    const txnIds = txns.map(t => t.id)
    await db.transactions.bulkDelete(txnIds)
    await db.statementUploads.where('accountId').equals(accountId).delete()
    await db.accounts.delete(accountId)
    window.dispatchEvent(new Event('finflow:data-imported'))
  }

  // Delete a single statement + its transactions for that month
  const handleDeleteStatement = async (accountId, statementId, month, year) => {
    const txns = await db.transactions.where('accountId').equals(accountId).toArray()
    const toDelete = txns.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
    await db.transactions.bulkDelete(toDelete.map(t => t.id))
    await db.statementUploads.delete(statementId)
    window.dispatchEvent(new Event('finflow:data-imported'))
  }

  // Toggle account type AND reprocess all transactions for that account
  const handleToggleAccountType = async (account) => {
    const newType = account.type === 'credit' ? 'debit' : 'credit'
    await accountsRepo.update(account.id, { type: newType })

    // Re-categorize all transactions for this account
    const userRules = await categoryRulesRepo.getAll()
    const txns = await db.transactions.where('accountId').equals(account.id).toArray()

    for (const t of txns) {
      const userCat = categorizeFromRule(t.description, userRules)
      if (userCat) {
        await transactionsRepo.update(t.id, { category: userCat, isTransfer: false, isIncome: false })
      } else {
        const auto = categorizeTransaction(t.description, t.amount, t.direction)
        await transactionsRepo.update(t.id, {
          category: auto.category,
          isTransfer: auto.isTransfer,
          isIncome: auto.isIncome,
        })
      }
    }

    // Re-run transfer pair detection across all accounts
    const allTxns = await db.transactions.toArray()
    // First clear old transfer flags for this account's transactions
    for (const t of txns) {
      if (t.isTransfer) {
        await transactionsRepo.update(t.id, { isTransfer: false, transferPairId: null })
      }
    }
    const pairs = detectTransferPairs(await db.transactions.toArray())
    for (const pair of pairs) {
      await transactionsRepo.update(pair.fromTxnId, { isTransfer: true, transferPairId: pair.id })
      await transactionsRepo.update(pair.toTxnId, { isTransfer: true, transferPairId: pair.id })
    }

    window.dispatchEvent(new Event('finflow:data-imported'))
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
                      {entry.file} — {entry.result.accountInfo.bank || 'Unknown Bank'} {entry.accountType === 'credit' ? 'Card' : 'Account'}
                    </h4>
                    <p className={`text-xs ${textMuted}`}>
                      {entry.result.accountInfo.last4 ? `ending in ${entry.result.accountInfo.last4}` : ''}
                      {' · '}{entry.result.statementInfo.transactionCount} transactions
                      {' · '}{new Date(entry.result.statementInfo.year, entry.result.statementInfo.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Account type selector */}
                <div className={`mb-3 flex items-center gap-2`}>
                  <span className={`text-xs font-medium ${textMuted}`}>Account type:</span>
                  {['debit', 'credit'].map(type => (
                    <button
                      key={type}
                      onClick={() => updateParseResult(idx, { accountType: type })}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                        entry.accountType === type
                          ? type === 'credit'
                            ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                          : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {type === 'credit' ? 'Credit Card' : 'Debit / Checking'}
                    </button>
                  ))}
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
                  <div key={account.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                          <span className={`text-xs font-bold text-${color}-400`}>{initials}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${textMain}`}>{account.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <button
                              onClick={() => handleToggleAccountType(account)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                account.type === 'credit'
                                  ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                              }`}
                              title="Click to toggle — reprocesses all transactions"
                            >
                              {account.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                            </button>
                            {account.last4 && <span className={`text-xs ${textDim}`}>· ****{account.last4}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-xs ${textMuted}`}>
                            {acctStatements.length} statement{acctStatements.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => { if (confirm(`Delete "${account.name}" and all its transactions?`)) handleDeleteAccount(account.id) }}
                          className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete account and all transactions"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Statement list with individual delete */}
                    {acctStatements.length > 0 && (
                      <div className="flex gap-1.5 mt-2 ml-11 flex-wrap">
                        {acctStatements.map((s) => {
                          const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][s.month - 1]
                          return (
                            <div key={s.id} className="group relative flex items-center gap-0.5 px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                {monthLabel} {String(s.year).slice(2)}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${monthLabel} ${s.year} statement and its transactions?`)) handleDeleteStatement(account.id, s.id, s.month, s.year) }}
                                className="ml-1 opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-opacity cursor-pointer"
                                title={`Delete ${monthLabel} ${s.year} statement`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
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

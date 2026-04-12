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
  const [parseResult, setParseResult] = useState(null)
  const [error, setError] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [fileType, setFileType] = useState(null)

  const accounts = useLiveQuery(() => db.accounts.toArray()) || []
  const statements = useLiveQuery(() => db.statementUploads.toArray()) || []

  const handleFile = useCallback(async (file) => {
    setError(null)
    setParseResult(null)
    setImported(false)
    setShowNamePrompt(false)

    const isCSV = file.name.toLowerCase().endsWith('.csv')
    const isPDF = file.name.toLowerCase().endsWith('.pdf')

    if (!isCSV && !isPDF) {
      setError('Unsupported file type. Please upload a CSV or PDF statement.')
      return
    }

    setFileType(isPDF ? 'pdf' : 'csv')
    setParsing(true)

    try {
      let result
      if (isCSV) {
        const text = await file.text()
        result = await parseCSV(text)
      } else {
        result = await parsePDF(file)
      }
      setParseResult(result)

      // Check if account exists
      if (result.accountInfo.last4) {
        const existing = await accountsRepo.getByLast4(result.accountInfo.last4)
        if (!existing) {
          setNewAccountName(result.accountInfo.bank ? `${result.accountInfo.bank} ${result.accountInfo.type === 'credit' ? 'Card' : 'Checking'}` : '')
          setShowNamePrompt(true)
        }
      } else {
        setShowNamePrompt(true)
        setNewAccountName('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleImport = async () => {
    if (!parseResult) return
    setImporting(true)

    try {
      // Get or create account
      let accountId
      if (parseResult.accountInfo.last4) {
        const existing = await accountsRepo.getByLast4(parseResult.accountInfo.last4)
        if (existing) {
          accountId = existing.id
        }
      }

      if (!accountId) {
        accountId = await accountsRepo.create({
          name: newAccountName || `Account ****${parseResult.accountInfo.last4 || '????'}`,
          type: parseResult.accountInfo.type,
          last4: parseResult.accountInfo.last4 || '',
          limit: null,
          currency: 'USD',
        })
      }

      // Get user-defined category rules
      const userRules = await categoryRulesRepo.getAll()

      // Categorize transactions
      const categorized = parseResult.transactions.map(t => {
        // Try user rules first
        const userCat = categorizeFromRule(t.description, userRules)
        if (userCat) {
          return { ...t, accountId, category: userCat }
        }

        // Fall back to built-in rules
        const auto = categorizeTransaction(t.description, t.amount, t.direction)
        return {
          ...t,
          accountId,
          category: auto.category,
          isTransfer: auto.isTransfer,
          isIncome: auto.isIncome,
        }
      })

      // Add transactions
      await transactionsRepo.bulkAdd(categorized)

      // Detect transfer pairs across all transactions
      const allTxns = await db.transactions.toArray()
      const pairs = detectTransferPairs(allTxns)

      // Mark transfer pair transactions
      for (const pair of pairs) {
        await transactionsRepo.update(pair.fromTxnId, { isTransfer: true, transferPairId: pair.id })
        await transactionsRepo.update(pair.toTxnId, { isTransfer: true, transferPairId: pair.id })
      }

      // Record statement upload
      await statementsRepo.create({
        accountId,
        month: parseResult.statementInfo.month,
        year: parseResult.statementInfo.year,
      })

      setImported(true)
      setShowNamePrompt(false)
      window.dispatchEvent(new Event('finflow:data-imported'))
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
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
            className="hidden"
            onChange={handleFileInput}
          />
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isDark ? 'bg-brand-primary/10' : 'bg-blue-50'}`}>
            <Upload className="w-8 h-8 text-brand-secondary" />
          </div>
          <h3 className={`text-lg font-semibold mb-1 ${textMain}`}>Drop your statement here</h3>
          <p className={`text-sm mb-4 ${textMuted}`}>CSV and PDF files supported</p>
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
            <p className={`text-sm ${textMain}`}>Parsing {fileType === 'pdf' ? 'PDF' : 'CSV'} statement...</p>
            {fileType === 'pdf' && (
              <p className={`text-xs mt-1 ${textDim}`}>Extracting text and detecting transactions</p>
            )}
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Parse Result Preview */}
        {parseResult && !imported && (
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h4 className={`font-medium text-sm ${textMain}`}>
                  Auto-detected: {parseResult.accountInfo.bank || 'Unknown Bank'} {parseResult.accountInfo.type === 'credit' ? 'Card' : 'Account'}
                </h4>
                <p className={`text-xs ${textMuted}`}>
                  {parseResult.accountInfo.type} {parseResult.accountInfo.last4 ? `ending in ${parseResult.accountInfo.last4}` : ''}
                  {' · '}{parseResult.statementInfo.transactionCount} transactions
                  {' · '}{new Date(parseResult.statementInfo.year, parseResult.statementInfo.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {showNamePrompt && (
              <div className={`mb-4 p-4 rounded-lg border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <label className={`text-xs font-medium ${textMuted}`}>Name this account:</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., Chase Sapphire Reserve"
                  className={`mt-2 w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-1.5 bg-brand-accent text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </Card>
        )}

        {/* Import Success */}
        {imported && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200'}`}>
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                Successfully imported {parseResult.statementInfo.transactionCount} transactions!
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600'}`}>
                Transactions have been categorized and transfers detected automatically.
              </p>
            </div>
          </div>
        )}

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

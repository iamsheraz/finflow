import { useState, useCallback } from 'react'
import { categorizeWithClaude } from '@/lib/claudeApi'
import { transactionsRepo } from '@/db/transactions'
import { categoryRulesRepo } from '@/db/categoryRules'

export function useClaude() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Categorize uncategorized transactions using Claude API.
   * For each unique merchant without a category, calls Claude once
   * and saves the rule for future use.
   */
  const categorizeUnknowns = useCallback(async (transactions) => {
    const uncategorized = transactions.filter(
      t => !t.category && !t.isTransfer && !t.isIncome
    )

    if (uncategorized.length === 0) return { categorized: 0 }

    // Group by merchant to avoid duplicate API calls
    const merchantMap = {}
    for (const t of uncategorized) {
      const key = t.merchant || t.description
      if (!merchantMap[key]) merchantMap[key] = []
      merchantMap[key].push(t)
    }

    setLoading(true)
    setError(null)
    let categorized = 0

    try {
      for (const [merchant, txns] of Object.entries(merchantMap)) {
        try {
          const category = await categorizeWithClaude(merchant)

          // Update all transactions for this merchant
          for (const t of txns) {
            await transactionsRepo.update(t.id, { category })
            categorized++
          }

          // Save rule for future use
          await categoryRulesRepo.create({
            merchantPattern: merchant.toLowerCase(),
            category,
            source: 'auto',
          })
        } catch (err) {
          console.warn(`Failed to categorize "${merchant}":`, err.message)
          // Continue with other merchants
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }

    return { categorized }
  }, [])

  return { categorizeUnknowns, loading, error }
}

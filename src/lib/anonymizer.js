/**
 * Anonymizes financial data before sending to Claude API.
 *
 * Rules (from spec):
 * 1. STRIP: account numbers, last4, account names, merchant addresses
 * 2. AGGREGATE: send category totals only, not individual merchant breakdowns
 * 3. PRESERVE: real dollar amounts, percentages, trends, transaction counts
 * 4. RE-HYDRATE locally: Claude returns category-level insights, app maps back to merchants
 */

export function anonymizeForSuggestions({ spendingByCategory, income, realSpending, savingsRate, transfers, creditCards, missingStatements }) {
  const categories = Object.entries(spendingByCategory).map(([name, data]) => ({
    category: name,
    total: Math.round(data.total * 100) / 100,
    transactionCount: data.count,
    percentOfTotal: realSpending > 0 ? Math.round((data.total / realSpending) * 100) : 0,
  }))

  const utilization = creditCards.map((card, i) => ({
    card: `Card ${i + 1}`,
    utilizationPercent: card.limit ? Math.round(((card.balance || 0) / card.limit) * 100) : 0,
    isOverThreshold: card.limit ? ((card.balance || 0) / card.limit) > 0.3 : false,
  }))

  return {
    period: 'current_month',
    summary: {
      realSpending: Math.round(realSpending * 100) / 100,
      income: Math.round(income * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
      transfersExcluded: Math.round(transfers * 100) / 100,
    },
    categories,
    creditUtilization: utilization,
    dataQuality: {
      missingStatementCount: missingStatements,
    },
  }
}

export function buildSuggestionsPrompt(anonymizedData) {
  return `You are a personal finance advisor. Analyze this spending data and return 3-5 actionable insights about leakage, recurring costs, or budget opportunities. Be specific with numbers. No generic advice.

Data:
${JSON.stringify(anonymizedData, null, 2)}`
}

export function buildCategorizationPrompt(merchantName) {
  return `You are a transaction categorizer. Given a merchant name, return one of:
Groceries | Dining | Bills & Utilities | Subscriptions | Gas & Transport | Shopping | Health | International Transfers | Other

Return only the category name, nothing else.

Merchant: ${merchantName}`
}

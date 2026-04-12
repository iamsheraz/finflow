/**
 * Claude API client — calls through serverless proxy.
 * The API key never touches the client.
 */

const PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || '/api/claude-proxy'

export async function callClaude(systemPrompt, userMessage) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: systemPrompt,
      message: userMessage,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data = await response.json()
  return data.content || data.text || data.response
}

export async function categorizeWithClaude(merchantName) {
  const response = await callClaude(
    `You are a transaction categorizer. Given a merchant name or transaction description, return EXACTLY one of these categories:
Groceries | Dining | Bills & Utilities | Subscriptions | Gas & Transport | Shopping | Health | Housing | Cash & ATM | Donations | Insurance | Travel | Investments | International Transfers | Other

Guidelines:
- Restaurants, fast food, cafes, food delivery → Dining
- Software subscriptions (GitHub, Cursor, Netflix, etc.) → Subscriptions
- Car rentals, trains, rideshare, gas stations → Gas & Transport
- Hotels, flights, Airbnb → Travel
- Insurance premiums, property casualty → Insurance
- ATM withdrawals → Cash & ATM
- Mortgage, rent → Housing
- Charity, welfare, religious donations → Donations
- Brokerage, investment platforms → Investments
- Utility bills, phone bills, city fees, government fees → Bills & Utilities

Return only the category name, nothing else.`,
    merchantName
  )

  const validCategories = [
    'Groceries', 'Dining', 'Bills & Utilities', 'Subscriptions',
    'Gas & Transport', 'Shopping', 'Health', 'Housing', 'Cash & ATM',
    'Donations', 'Insurance', 'Travel', 'Investments',
    'International Transfers', 'Other'
  ]

  const trimmed = (response || '').trim()
  return validCategories.includes(trimmed) ? trimmed : 'Other'
}

export async function getSuggestions(anonymizedData) {
  const response = await callClaude(
    `You are a personal finance advisor. Analyze this spending data and return 3-5 actionable insights about leakage, recurring costs, or budget opportunities. Be specific with numbers. No generic advice. Return as a JSON array of objects with "type" (leakage|subscription|credit|transfer|income|data_quality), "title", and "description" fields.`,
    JSON.stringify(anonymizedData, null, 2)
  )

  try {
    // Try to parse JSON from response
    const match = response.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    return []
  }
}

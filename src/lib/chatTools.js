/**
 * Tool definitions for Claude tool_use.
 * These are sent to the API so Claude knows what tools are available.
 * The actual execution happens client-side against Dexie/IndexedDB.
 */

export const CHAT_TOOLS = [
  {
    name: 'search_transactions',
    description: 'Search and filter user transactions. Use this to find specific transactions by merchant, category, date range, or amount. Returns matching transactions with full details.',
    input_schema: {
      type: 'object',
      properties: {
        merchant: {
          type: 'string',
          description: 'Merchant name or partial name to search for (case-insensitive). Examples: "Starbucks", "Zelle", "AT&T", "Amazon"',
        },
        category: {
          type: 'string',
          description: 'Category to filter by. One of: Groceries, Dining, Bills & Utilities, Subscriptions, Gas & Transport, Shopping, Health, International Transfers, Other',
        },
        year: {
          type: 'integer',
          description: 'Year to filter transactions (e.g., 2025, 2026)',
        },
        month: {
          type: 'integer',
          description: 'Month number (1-12) to filter transactions. Use with year.',
        },
        direction: {
          type: 'string',
          enum: ['debit', 'credit'],
          description: 'Transaction direction: "debit" for spending/outgoing, "credit" for income/incoming',
        },
        min_amount: {
          type: 'number',
          description: 'Minimum transaction amount (absolute value)',
        },
        max_amount: {
          type: 'number',
          description: 'Maximum transaction amount (absolute value)',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of transactions to return. Default 50.',
        },
      },
      required: [],
    },
  },
  {
    name: 'sum_spending',
    description: 'Calculate total spending amount for filtered transactions. Use this to answer "how much did I spend on X" questions. Returns the total sum and transaction count.',
    input_schema: {
      type: 'object',
      properties: {
        merchant: {
          type: 'string',
          description: 'Merchant name or partial name (case-insensitive)',
        },
        category: {
          type: 'string',
          description: 'Category to filter by',
        },
        year: {
          type: 'integer',
          description: 'Year to filter (e.g., 2025)',
        },
        month: {
          type: 'integer',
          description: 'Month number (1-12)',
        },
        exclude_transfers: {
          type: 'boolean',
          description: 'Whether to exclude transfer transactions. Default true.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_spending_by_category',
    description: 'Get spending breakdown by category for a given time period. Returns each category with total amount and transaction count.',
    input_schema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description: 'Year to get breakdown for',
        },
        month: {
          type: 'integer',
          description: 'Month number (1-12). If omitted, returns full year.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_budget_status',
    description: 'Get current budget limits and how much has been spent against each budget for the current month. Shows which budgets are over/under.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Specific category to check. If omitted, returns all budgets.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_account_summary',
    description: 'Get list of all user accounts (bank accounts and credit cards) with their details.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_recurring_expenses',
    description: 'Get detected recurring/subscription expenses with their monthly and annual cost estimates.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_top_merchants',
    description: 'Get the top merchants by total spending amount for a given time period.',
    input_schema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description: 'Year to filter',
        },
        month: {
          type: 'integer',
          description: 'Month number (1-12). If omitted, returns full year.',
        },
        limit: {
          type: 'integer',
          description: 'Number of top merchants to return. Default 10.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_income_summary',
    description: 'Get income summary for a given time period. Returns total income, income sources, and deposits.',
    input_schema: {
      type: 'object',
      properties: {
        year: {
          type: 'integer',
          description: 'Year to filter',
        },
        month: {
          type: 'integer',
          description: 'Month number (1-12). If omitted, returns full year.',
        },
      },
      required: [],
    },
  },
]

// Rule-based merchant-to-category mapping
const CATEGORY_RULES = [
  // Groceries
  { pattern: /walmart|costco|heb|kroger|safeway|aldi|trader.?joe|wholefds|whole foods|publix|sprouts|food.?lion|winco|meijer|target.*(grocer|food)/i, category: 'Groceries' },
  // Dining
  { pattern: /mcdonald|burger king|wendy|chili|applebee|olive garden|doordash|uber.?eat|grubhub|chipotle|starbucks|dunkin|subway|taco bell|domino|pizza hut|panda express|chick.?fil|popeye|ihop|denny|waffle house|panera/i, category: 'Dining' },
  // Bills & Utilities
  { pattern: /at&t|t-mobile|verizon|comcast|xfinity|spectrum|oncor|electric|water.?dept|gas.?co|sewer|waste|internet|cox comm|centurylink/i, category: 'Bills & Utilities' },
  // Subscriptions
  { pattern: /netflix|spotify|hulu|disney\+|hbo|apple.?(tv|music|one)|youtube.?prem|adobe|microsoft.?365|amazon.?prime|audible|paramount|peacock|dropbox|chatgpt|openai/i, category: 'Subscriptions' },
  // Gas & Transport
  { pattern: /shell|exxon|chevron|bp|mobil|valero|marathon|circle.?k|speedway|uber(?!.*eat)|lyft|parking|toll|metro|transit/i, category: 'Gas & Transport' },
  // Shopping
  { pattern: /amazon(?!.*prime)|target(?!.*(grocer|food))|best.?buy|macy|nordstrom|tj.?maxx|marshalls|ross|home.?depot|lowe|ikea|wayfair|etsy|ebay/i, category: 'Shopping' },
  // Health
  { pattern: /cvs|walgreens|rite.?aid|pharmacy|doctor|hospital|clinic|dental|vision|optom|urgent.?care|labcorp|quest.?diag/i, category: 'Health' },
  // International Transfers
  { pattern: /wire.?transfer|remittance|western.?union|moneygram|xoom|wise\.com|transferwise|remitly/i, category: 'International Transfers' },
]

// Transfer detection patterns
const TRANSFER_PATTERNS = [
  /payment.?thank.?you/i,
  /autopay/i,
  /online.?payment/i,
  /epayment/i,
  /ach.?pmt/i,
  /card.?payment/i,
  /balance.?transfer/i,
  /paypal.?transfer/i,
  /zelle.*(?:send|transfer)/i,
  /venmo.?(?:cashout|transfer)/i,
]

// Income detection patterns
const INCOME_PATTERNS = [
  /payroll/i,
  /direct.?dep/i,
  /salary/i,
  /ach.?credit.*(?:employer|corp|inc|llc|ltd)/i,
  /tax.?refund/i,
  /irs.?treas/i,
]

export function categorizeTransaction(description, amount, direction) {
  const desc = description || ''

  // Check income first
  if (direction === 'credit') {
    for (const pattern of INCOME_PATTERNS) {
      if (pattern.test(desc)) {
        return { category: 'Income', isIncome: true, isTransfer: false }
      }
    }
  }

  // Check transfers
  for (const pattern of TRANSFER_PATTERNS) {
    if (pattern.test(desc)) {
      return { category: 'Transfer', isTransfer: true, isIncome: false }
    }
  }

  // Check spending categories
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(desc)) {
      return { category: rule.category, isTransfer: false, isIncome: false }
    }
  }

  return { category: null, isTransfer: false, isIncome: false }
}

export function categorizeFromRule(description, userRules) {
  const normalized = (description || '').toLowerCase()
  for (const rule of userRules) {
    if (normalized.includes(rule.merchantPattern.toLowerCase())) {
      return rule.category
    }
  }
  return null
}

// Rule-based merchant-to-category mapping
const CATEGORY_RULES = [
  // Housing (check before Bills — mortgage/rent is specific)
  { pattern: /mortgage|freedom mortgage|quicken loans|rocket mortgage|loan.?care|mr.?cooper|\brent\b|lease.?payment|hoa\b|homeowners/i, category: 'Housing' },
  // Cash & ATM
  { pattern: /atm.?withdrawal|atm.?cash|cash.?withdraw|atm\b.*\b(bank|withdrawal)|bank.?of.?america\s+atm/i, category: 'Cash & ATM' },
  // Donations
  { pattern: /saylani|ikca|donation|charity|welfare|zakat|sadaqah|masjid|mosque|church|temple|tithe|united.?way|red.?cross|salvation.?army|gofundme|habitat.?humanity|islamic.?relief/i, category: 'Donations' },
  // Insurance
  { pattern: /insurance|casualty|geico|state.?farm|allstate|progressive|liberty.?mutual|usaa.?ins|tesla.?property|property.?casualty|life.?ins|health.?ins|farmers.?ins|nationwide/i, category: 'Insurance' },
  // Travel
  { pattern: /hotel|marriott|hilton|hyatt|renaissance|airbnb|vrbo|booking\.com|expedia|airline|american.?air|united.?air|delta.?air|southwest|frontier.?air|spirit.?air|jet.?blue|cruise/i, category: 'Travel' },
  // Groceries
  { pattern: /walmart|costco|heb|kroger|safeway|aldi|trader.?joe|wholefds|whole foods|publix|sprouts|food.?lion|winco|meijer|target.*(grocer|food)|sam.?s club/i, category: 'Groceries' },
  // Dining
  { pattern: /mcdonald|burger.?king|wendy|chili|applebee|olive.?garden|doordash|uber.?eat|grubhub|chipotle|starbucks|dunkin|subway|taco.?bell|domino|pizza.?hut|panda.?express|chick.?fil|popeye|ihop|denny|waffle.?house|panera|bbq|grill|restaurant|cafe|diner|halal|burger|wings|taqueria|bakery|sushi|ramen|pho|thai|chinese|indian|mediterranean|kebab|shawarma|falafel|yummy/i, category: 'Dining' },
  // Bills & Utilities
  { pattern: /\bat&t\b|\batt\b.*\b(bill|payment)\b|t-mobile|verizon|comcast|xfinity|spectrum|oncor|electric|water.?dept|gas.?co|sewer|waste|internet|cox.?comm|centurylink|dallas.?water|atmos.?energy|energy|power|city\s+of\s+\w+\s*(misc|util|water|tax)|txdps|driver.?lic/i, category: 'Bills & Utilities' },
  // Subscriptions
  { pattern: /netflix|spotify|hulu|disney\+|hbo|apple.?(tv|music|one)|youtube.?prem|adobe|microsoft(?!.*xbox)|amazon.?prime|audible|paramount|peacock|dropbox|chatgpt|openai|github|cursor|copilot|notion|figma|canva|slack|zoom|tesla.?subscri|oculus|meta.?quest|icloud|google.?one|1password|lastpass|nordvpn|expressvpn/i, category: 'Subscriptions' },
  // Gas & Transport
  { pattern: /shell|exxon|chevron|bp\b|mobil|valero|marathon|circle.?k|speedway|uber(?!.*eat)|lyft|parking|toll|metro|transit|railway|train|amtrak|hertz|enterprise|avis|budget.?rent|car.?rental|national.?car/i, category: 'Gas & Transport' },
  // Shopping
  { pattern: /amazon(?!.*prime)|target(?!.*(grocer|food))|best.?buy|macy|nordstrom|tj.?maxx|marshalls|ross|home.?depot|lowe|ikea|wayfair|etsy|ebay|apple\.com|apple\s+store|microsoft.?store|nike|adidas|zara|h&m|shein|temu|fashion/i, category: 'Shopping' },
  // Health
  { pattern: /cvs|walgreens|rite.?aid|pharmacy|doctor|hospital|clinic|dental|vision|optom|urgent.?care|labcorp|quest.?diag|medical|health|therapy|counseling|chiropract/i, category: 'Health' },
  // Investments
  { pattern: /frontier.?sec|fidelity|schwab|vanguard|etrade|e\*trade|robinhood|webull|td.?ameri|merrill|edward.?jones|wealthfront|betterment|acorns|sofi.?invest|brokerage|investment/i, category: 'Investments' },
  // International Transfers
  { pattern: /wire.?transfer|remittance|western.?union|moneygram|xoom|wise\.com|transferwise|remitly/i, category: 'International Transfers' },
]

// Transfer detection patterns (money moving between your own accounts / paying your own cards)
const TRANSFER_PATTERNS = [
  /payment.?thank.?you/i,
  /autopay/i,
  /online.?(scheduled\s+)?payment/i,
  /epayment/i,
  /ach.?pmt/i,
  /card.?payment/i,
  /balance.?transfer/i,
  /paypal.?transfer/i,
  /venmo.?(?:cashout|transfer)/i,
  /card\s+member\s+services?\s+web\s+payment/i,
  /american\s+express\s+payment/i,
  /apple\s+card.*payment/i,
  /credit\s+union\s+bill\s+pay/i,
  /payment\s+sent/i,
  /zelle\s+payment/i,
  /zelle.*(?:send|transfer|payment)/i,
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

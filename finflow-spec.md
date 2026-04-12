# FinFlow — Personal Finance Manager
## Full Product Spec & Build Plan

---

## What It Does

Upload bank and credit card statements (CSV or PDF) and get an intelligent breakdown of where your money goes — with automatic transfer detection, credit utilization tracking, net worth calculation, and AI-powered budget suggestions.

Core problem it solves: with 10+ credit cards and multiple debit accounts, naive finance apps double-count card payments as spending. FinFlow separates transfers from real spending so every number is accurate.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Tailwind CSS | Component-friendly, fast to build, mobile-ready |
| Build Tool | Vite | Fast HMR, works seamlessly with Capacitor for mobile |
| Charts | Victory | Cross-platform — Victory Native has near-identical API for mobile |
| CSV parsing | PapaParse (client-side) | Best browser CSV parser, streaming support, no backend needed |
| PDF parsing | pdfplumber (Python) or pdf-parse (Node) | Phase 2 |
| Categorization | Claude API (claude-sonnet-4-20250514) | Merchant to category mapping |
| Storage | Dexie.js (IndexedDB wrapper) | Clean Promise API, ~29KB, easy swap to SQLite on mobile |
| API Proxy | Serverless function (Vercel/Cloudflare Worker) | Keeps API key off client, anonymizes data before Claude calls |
| Backend (optional) | Node + Express or FastAPI | For PDF parsing + heavier AI calls |
| Mobile (future) | Capacitor | Wraps React app for App Store / Google Play without rewrite |

### Storage Strategy

MVP uses **Dexie.js** over raw IndexedDB for cleaner API and better performance. The data layer is abstracted behind a repository pattern so storage can be swapped later:

| Phase | Web | Mobile (Capacitor) |
|---|---|---|
| MVP | Dexie.js (IndexedDB) | N/A |
| Mobile launch | Dexie.js (IndexedDB) | SQLite via `@capacitor-community/sqlite` |
| Cross-device sync | RxDB (swappable backend, built-in encryption + replication) | RxDB with SQLite adapter |

**Why not raw IndexedDB?** Verbose API, writes are ~10x slower than alternatives, and browser can evict data under storage pressure. Dexie.js wraps it cleanly. For mobile, IndexedDB in a WebView is unreliable — SQLite stores on the filesystem and persists properly.

---

## Data Model

```
Account
  id, name, type (credit | debit | paypal), last4, limit (credit only), currency

Transaction
  id, accountId, date, description, merchant, amount, direction (debit | credit)
  category, isTransfer, transferPairId, isRecurring, isIncome

TransferPair
  id, fromTxnId, toTxnId, amount, confidence (auto | manual)

StatementUpload
  id, accountId, month, year, uploadedAt, status (complete | partial)

Budget
  id, category, monthlyLimit, currentSpend

UserPreference
  id, key, value  (theme, currency, dateFormat, locale)

SyncMetadata
  id, lastSyncAt, deviceId, version  (for future cross-device sync)

CategoryRule
  id, merchantPattern, category, source (auto | user), createdAt
```

**Data access pattern:** All database operations go through a repository layer (`src/lib/db/`), never direct Dexie/IndexedDB calls from components. This lets us swap Dexie for SQLite on mobile without touching business logic.

---

## Feature List

### 1. Upload System
- Single upload button — auto-detects account type from file headers
- Supports multiple banks and cards — each upload routes to its account slot
- New account detected on first upload — prompt user to name it once, remember forever
- Parses: merchant name, date, amount, direction (debit/credit)
- Shows upload history per account with month coverage

### 2. Transfer vs Spending Detection (Critical)
- Every outgoing transaction classified as one of three types:
  - **Spending** — money to an external merchant. Counts in totals.
  - **Transfer** — money moving between your own accounts. Excluded from spending.
  - **Income** — incoming salary, freelance, etc.
- Auto-detection rules:
  - Matching amount + near date across debit out / credit in = transfer pair
  - Description contains "payment thank you", "autopay", "online payment" = transfer
  - PayPal send to self = transfer
- Anything unclassified is flagged for one-time user review
- Rule is remembered after first label
- Impact shown clearly: gross out vs real spending vs transfers excluded

### 3. Category Breakdown
Auto-tagged categories:

| Category | Example Merchants |
|---|---|
| Groceries | Walmart, Costco, HEB, Kroger |
| Dining | McDonald's, Chili's, DoorDash, Uber Eats |
| Bills & Utilities | AT&T, Oncor, water dept |
| Subscriptions | Netflix, Spotify, Adobe CC |
| Gas & Transport | Shell, ExxonMobil, Uber |
| Shopping | Amazon, Target, Macy's |
| Health | CVS, Walgreens, doctor offices |
| International Transfers | Wire transfers, remittances |

- User can re-tag any merchant — rule applies globally going forward
- Drill-down: Category → Merchant → Individual transactions (date + amount)

### 4. Merchant Detail View
Tapping a merchant shows:
- Every transaction with date and amount
- Monthly totals grouped by month
- Frequency trend (visiting more or less?)
- Flag if spend is increasing month-over-month

### 5. Recurring Detection
- Flags same merchant, similar amount, monthly cadence = subscription
- Shows recurring badge with monthly cost and year-to-date total
- Dedicated panel: "What am I paying every month?"
- Includes: subscriptions, rent, insurance, gym, utilities

### 6. Credit Utilization Monitor
- Per-card utilization bar (balance / limit)
- Color coded: green under 20%, amber 20-30%, red over 30%
- Overall utilization across all cards
- Cards over 30% flagged — these hurt credit score most
- Updates every time a new statement is uploaded

### 7. Net Worth Tracker
- Assets: sum of all debit account balances
- Liabilities: sum of all credit card balances owed
- Net worth = assets minus liabilities
- Month-over-month change tracked automatically
- Updates on every upload — no manual entry

### 8. Income Pattern
- Auto-detects incoming deposits that are not refunds or transfers
- Groups by source (employer, freelance, etc.)
- 6-month bar chart of income stability
- Savings rate = (income - real spending) / income
- Flags missing paycheck months

### 9. Statement Gap Detector
- Visual grid: each account × each month — green (uploaded) or red (missing)
- Warning banner on dashboard if any gaps detected
- Missing months cause blind spots in recurring detection and category totals
- Prompt to upload missing statements

### 10. Suggestions Engine
Powered by Claude API — reads your **anonymized, aggregated** numbers and generates:
- Leakage alerts: "Dining up 42% vs your 3-month average"
- Subscription audit: "7 active subscriptions — $105/month"
- Utilization alerts: "Barclays at 67% — pay this down first"
- Transfer confirmation: "You correctly excluded $5,612 in card payments"
- Income insight: "Paycheck lands 1st and 15th — most spending happens days 2-5"
- Data quality: "Feb statement missing for Amex Gold — Q1 totals incomplete"

### 11. Data Export & Backup
- Export all data as JSON or CSV — one click from settings
- Encrypted backup file option (password-protected)
- Import from backup to restore on new device
- Critical for user trust — "your data, your control"

### 12. PWA Support
- Service worker + web manifest for installable app experience
- Offline-capable — all data is local, app works without internet
- Push notifications for budget alerts (when online)
- Bridges the gap before native mobile app launches

---

## Dashboard Pages

### Overview
- 4 metric cards: real spending, income, savings rate, net worth
- Spending by category donut/bar
- Transfer detection summary
- Utilization snapshot (top 5 cards)

### Transfers vs Spending
- Full transaction list with labels: Transfer / Income / Spending / Review needed
- Gross out vs real spending reconciliation at top
- Flag unclassified transactions for review

### Credit Utilization
- All 10 cards in one view
- Per-card bar with percentage and balance/limit
- Overall utilization score

### Net Worth
- Assets list (debit balances)
- Liabilities list (credit card balances)
- Net total with month delta

### Income
- 6-month income bar chart
- Source breakdown
- Savings rate trend

### Statement Gaps
- Grid view: account × month
- Color coded coverage
- Quick upload link per gap

### Suggestions
- Leakage alerts
- Transfer insights
- Savings highlights
- Data quality warnings

---

## Data Hierarchy

```
Account (Debit / Credit / PayPal)
  └── Month
        └── Category (Groceries, Dining, Bills...)
              └── Merchant (Walmart, Netflix, Shell...)
                    └── Transaction (Date | Amount | Description)
```

Clicking any level drills down to the next. Breadcrumb navigation at top.

---

## MVP Build Order

### Phase 1 — Core (build first)
1. Vite + React + Tailwind project setup with responsive layout (test at 375px)
2. Dexie.js database with repository pattern abstraction
3. CSV upload + parse (PapaParse)
4. Account detection and naming
5. Transaction list with basic categories (rule-based)
6. Transfer detection (rule-based)
7. Monthly overview dashboard (Victory charts)

### Phase 2 — Intelligence
8. Serverless API proxy (Vercel/Cloudflare Worker) for Claude calls
9. Claude API categorization for unknown merchants
10. Recurring detection
11. Statement gap detector
12. Credit utilization view
13. Net worth tracker
14. Dark mode (Tailwind `dark:` classes)

### Phase 3 — Insights + Polish
15. Income pattern detection
16. Claude API suggestions engine (anonymized data only)
17. Budget caps with progress bars
18. Month-over-month diff explainer
19. PDF statement parsing
20. Data export & backup (JSON/CSV + encrypted backup)
21. PWA support (service worker + manifest)

### Phase 4 — Mobile
22. Capacitor setup + native shell (iOS + Android)
23. SQLite migration for mobile storage (`@capacitor-community/sqlite`)
24. Native file picker for statement import
25. Biometric lock (fingerprint/Face ID via Capacitor plugin)
26. App Store / Google Play submission

---

## Key Rules for Claude Code Sessions

- Never count a credit card payment from a debit account as spending — it is a transfer
- Real spending = all outgoing transactions minus transfers minus income returns
- Savings rate uses real spending only, not gross out
- Category totals should warn if any month is missing for that account
- Utilization = current balance / credit limit per card
- Net worth updates on every statement upload — no manual balance entry

---

## File Structure (suggested)

```
finflow/
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── Overview.jsx
│   │   │   ├── TransferView.jsx
│   │   │   ├── UtilizationView.jsx
│   │   │   ├── NetWorthView.jsx
│   │   │   ├── IncomeView.jsx
│   │   │   ├── GapDetector.jsx
│   │   │   └── Suggestions.jsx
│   │   ├── Upload/
│   │   │   ├── UploadButton.jsx
│   │   │   └── StatementParser.js
│   │   ├── Accounts/
│   │   │   ├── AccountGrid.jsx
│   │   │   └── AccountCard.jsx
│   │   ├── Transactions/
│   │   │   ├── TransactionList.jsx
│   │   │   └── MerchantDetail.jsx
│   │   └── Settings/
│   │       ├── ExportData.jsx
│   │       ├── Preferences.jsx
│   │       └── BackupRestore.jsx
│   ├── lib/
│   │   ├── parser.js            # CSV parsing logic
│   │   ├── categorizer.js       # merchant → category rules
│   │   ├── transferDetector.js   # transfer pair matching
│   │   ├── recurringDetector.js
│   │   ├── anonymizer.js        # strips PII before Claude API calls
│   │   └── claudeApi.js         # suggestions + categorization (calls proxy)
│   ├── db/                      # Data access layer (repository pattern)
│   │   ├── index.js             # Dexie instance + schema
│   │   ├── accounts.js          # Account repository
│   │   ├── transactions.js      # Transaction repository
│   │   ├── budgets.js           # Budget repository
│   │   └── preferences.js       # UserPreference repository
│   ├── hooks/                   # Shared React hooks
│   │   ├── useAccounts.js
│   │   ├── useTransactions.js
│   │   └── usePreferences.js
│   └── App.jsx
├── api/                         # Serverless functions (Vercel/Cloudflare)
│   └── claude-proxy.js          # Anonymizes + proxies Claude API calls
├── public/
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker
├── capacitor.config.ts          # Added in Phase 4 for mobile
├── vite.config.js
├── package.json
└── README.md
```

**Key architecture decisions for mobile compatibility:**
- `src/db/` is the only layer that touches storage — swap Dexie for SQLite here when going mobile
- `src/lib/` contains pure business logic — framework-agnostic, reusable on any platform
- `src/hooks/` bridges business logic to React — shared between web and Capacitor builds
- `api/` runs serverless — works the same whether called from web or mobile

---

## Claude API Integration

All Claude API calls go through a **serverless proxy** (`api/claude-proxy.js`). The API key never touches the client.

Used in two places:

**1. Merchant categorization** — when rule-based matching fails
```
System: You are a transaction categorizer. Given a merchant name, return one of:
Groceries | Dining | Bills | Subscriptions | Gas | Shopping | Health | Transfer | Income | Other

Return only the category name, nothing else.

User: WHOLEFDS #10234
```
Low sensitivity — merchant names only, no amounts or account info.

**2. Suggestions engine** — monthly insights
```
System: You are a personal finance advisor. Analyze this spending data and return
3-5 actionable insights about leakage, recurring costs, or budget opportunities.
Be specific with numbers. No generic advice.

User: [Anonymized JSON — category totals only, no merchant names, no account numbers]
```

### Data Anonymization Rules

**All merchant-level detail (names, visit counts, per-merchant totals) is computed and displayed locally.** The app shows full granularity — "Walmart: 3 visits, $287" or "Uber: 15 rides, $312". None of this requires Claude.

Anonymization applies **only to the suggestions API call** — the one moment aggregated data leaves the device:

1. **Strip**: account numbers, last4 digits, account names, specific merchant addresses
2. **Aggregate**: send category totals (e.g., "Dining: $842, 28 transactions") not individual merchant breakdowns
3. **Preserve**: real dollar amounts, percentages, trends, transaction counts — Claude needs these for useful insights
4. **Re-hydrate locally**: Claude returns category-level insights ("Dining up 42%"), and the app maps them back to merchant detail ("Top dining: Chili's $480, DoorDash $220, Uber Eats $142") using local data

**What this means in practice:**

| Feature | Processed where | Claude involved? |
|---|---|---|
| Merchant drill-down (Walmart: 3 visits, $287) | Local only | No |
| Restaurant tracking (Chili's: 10 visits, $480) | Local only | No |
| Ride frequency (Uber: 15 rides, DoorDash: 20 orders) | Local only | No |
| Per-merchant monthly trends | Local only | No |
| Unknown merchant categorization ("WHOLEFDS #10234" = ?) | Claude API | Yes — merchant name only |
| Monthly spending insights and alerts | Claude API | Yes — category totals only, no merchant names |

The `src/lib/anonymizer.js` module handles the category-level aggregation before suggestions API calls.

---

## Security & Privacy

- **Local-first**: all financial data stays in the browser (Dexie.js/IndexedDB). Nothing is stored on a server.
- **API key protection**: Claude API key lives in the serverless proxy, never in client code.
- **Data anonymization**: the `anonymizer.js` module strips PII before any data leaves the device.
- **Content Security Policy**: strict CSP headers to prevent XSS exfiltration of financial data.
- **Encrypted backups**: export files are password-protected when encryption option is selected.
- **No Plaid, no bank credentials**: statement upload means we never handle login credentials.
- **Regulatory note**: local-only, no-bank-connection apps have minimal regulatory burden. No GLBA compliance needed. Still ship a clear privacy policy and Terms of Service.
- **Future (mobile)**: biometric lock via Capacitor plugin, SQLite data stored on device filesystem (not evictable WebView storage).

---

## Mobile Strategy

### Approach: Capacitor (wrap existing React app)

The React + Tailwind + Vite stack is built to be wrapped with **Capacitor** for native mobile distribution without rewriting the app.

| Decision | Web | Mobile (Capacitor) |
|---|---|---|
| UI framework | React + Tailwind | Same (runs in WebView) |
| Storage | Dexie.js (IndexedDB) | SQLite via `@capacitor-community/sqlite` |
| Charts | Victory | Same (SVG renders in WebView) |
| File import | Browser File API | Native file picker plugin |
| Auth/Lock | None (MVP) | Biometric lock (fingerprint/Face ID) |
| Distribution | URL / PWA | App Store + Google Play |

### Architecture decisions baked in from day one:
1. **Repository pattern** (`src/db/`) — storage-agnostic, swap Dexie for SQLite without touching components
2. **Pure business logic** (`src/lib/`) — no React imports, reusable anywhere
3. **Shared hooks** (`src/hooks/`) — bridge between logic and React, works in web and Capacitor
4. **Victory charts** — Victory Native has near-identical API if a fully native chart layer is ever needed
5. **Responsive layout** — all views designed and tested at 375px minimum width
6. **Centralized API calls** — single service module, easy to adapt for mobile networking

### When to go native?

Start with Capacitor (Phase 4). If performance or UX demands truly native feel later (complex gestures, 120fps animations), consider a dedicated **React Native / Expo** app that imports the shared `src/lib/` business logic.

---

## Multi-Currency Support

Since the no-Plaid approach enables international users:
- `currency` field on Account model
- Display amounts in account's native currency
- Dashboard totals converted to user's preferred currency (set in Preferences)
- Exchange rates fetched from a free API (e.g., exchangerate.host) and cached locally
- Phase 2+ feature — not needed for MVP if targeting single-currency users first

---

## Notes

- No login required for MVP — all data stays local in Dexie.js (IndexedDB)
- User controls all data — no server uploads unless they opt into cloud sync
- International transfer category important for remittance tracking (annual tax visibility)
- Statement gap warning should be prominent — silent gaps corrupt all insights
- Dark mode via Tailwind `dark:` classes — toggle in Preferences
- PWA installable on mobile before native app launches (Phase 3)

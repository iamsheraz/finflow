<div align="center">

<img src="public/favicon.svg" width="80" height="80" alt="FinFlow logo" />

# FinFlow

**Local-first personal finance manager that actually gets the numbers right.**

Upload your bank & credit card statements. Get an intelligent breakdown of where your money goes — with smart transfer detection, credit utilization tracking, and AI-powered insights.

[Getting Started](#getting-started) &middot; [Features](#features) &middot; [Tech Stack](#tech-stack) &middot; [Deploy](#deploy)

</div>

---

## The Problem

With multiple credit cards and bank accounts, every finance app gets it wrong. Pay your Chase bill from your checking account? That's **not** spending — it's a transfer. But most tools count it twice.

FinFlow separates **transfers from real spending** so every number is accurate.

```
Gross outgoing:     $9,895
- Transfers:        $5,612   (card payments, account moves)
= Real spending:    $4,283   <-- this is the number that matters
```

## Getting Started

```bash
# Clone & install
git clone https://github.com/iamsheraz/finflow.git
cd finflow
npm install

# Run locally
npm run dev
```

Open **http://localhost:5173** and import the included mock data to explore:

1. Go to **Settings** (bottom of sidebar)
2. Click **Import JSON Backup**
3. Select `public/mock-backup.json`
4. All 12 pages populate with 3 months of realistic data

## Features

### Core

- **CSV & PDF Upload** — Drag-drop statements from any bank. Auto-detects bank, account type, card last-4, and statement period
- **Transfer Detection** — Matches card payments across accounts by amount + date. Never double-counts
- **Smart Categorization** — Rule-based engine covers 100+ merchants across 8 categories. Falls back to Claude AI for unknowns
- **Transaction Verification** — Manually review and verify each transaction. Mark anything suspicious as "needs attention" and come back later

### Pages

| Page | What it does |
|---|---|
| **Overview** | 4 metric cards (spending, income, savings rate, net worth) + category chart + transfer summary |
| **Upload** | Drag-drop CSV/PDF with bank auto-detection and account naming |
| **Transfers** | Classify transactions as spending, transfer, or income. Uncategorized items flagged for review |
| **Spending** | 3-level drill-down: Category → Merchant → Transaction. Per-item verification with "verify all" |
| **Recurring** | Auto-detects subscriptions and bills. Shows monthly + annual cost estimates |
| **Budgets** | Set per-category limits with progress bars. Alerts when over budget |
| **Credit Cards** | Per-card utilization bars. Color-coded: green < 20%, amber 20-30%, red > 30% |
| **Net Worth** | Assets (debit balances) minus liabilities (credit balances) |
| **Income** | Income sources, deposit history, savings rate |
| **Gaps** | Account x month grid showing uploaded vs missing statements |
| **Suggestions** | Dynamic insights: leakage alerts, subscription audit, utilization warnings |
| **Settings** | Theme toggle, JSON/CSV export, backup restore, clear data |

### Privacy & Security

- **100% local-first** — All financial data stays in your browser (IndexedDB via Dexie.js)
- **No bank credentials** — Statement upload means we never handle logins
- **API key protection** — Claude API calls go through a serverless proxy, key never touches the client
- **Data anonymization** — Only category-level aggregates sent to AI, never merchant names or account numbers
- **Your data, your control** — Export everything as JSON backup or CSV anytime

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Tailwind CSS 4 |
| Build | Vite 8 |
| Storage | Dexie.js (IndexedDB) |
| CSV Parsing | PapaParse |
| PDF Parsing | pdf.js (Mozilla) |
| AI | Claude API via serverless proxy |
| Icons | Lucide React |
| Routing | React Router 7 |

### Architecture

```
src/
├── components/Layout/   # Sidebar, AppLayout, PageHeader, Card, MonthSelector
├── db/                  # Dexie.js schema + repository pattern (7 tables)
├── hooks/               # useTheme, useMonth, useTransactions, useRecurring, useClaude
├── lib/                 # Pure business logic (parser, categorizer, transferDetector, etc.)
├── pages/               # 12 page components
└── App.jsx              # Router setup

api/
└── claude-proxy.js      # Vercel Edge Function for Claude API

public/
├── manifest.json        # PWA manifest
├── sw.js                # Service worker (offline support)
└── mock-backup.json     # Sample data for testing
```

All database operations go through a **repository layer** (`src/db/`). Business logic in `src/lib/` is framework-agnostic — no React imports. This makes the storage layer swappable (Dexie → SQLite for mobile) without touching business logic.

## Deploy

### Vercel (recommended)

```bash
# Push to GitHub, then:
vercel --prod
```

Set `ANTHROPIC_API_KEY` in Vercel environment variables for AI features.

The `vercel.json` handles SPA routing and the `api/claude-proxy.js` deploys as an Edge Function automatically.

### Static (no AI features)

```bash
npm run build
# Serve the dist/ folder with any static host
```

Everything works without the Claude API — categorization falls back to the built-in rule engine.

## Roadmap

- [x] **Phase 1** — Core (upload, parse, categorize, transfer detection, dashboard)
- [x] **Phase 2** — Intelligence (recurring detection, Claude API, month selector)
- [x] **Phase 3** — Polish (PDF upload, budgets, export/import, PWA, verification system)
- [ ] **Phase 4** — Mobile (Capacitor, SQLite, biometric lock, App Store)

---

<div align="center">

Built with [Claude Code](https://claude.ai/code)

</div>

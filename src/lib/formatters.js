export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCurrencyFull(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

export function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatMonthYear(year, month) {
  const d = new Date(year, month - 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export const CATEGORY_COLORS = {
  'Groceries': { bg: 'bg-emerald-500', text: 'text-emerald-400', bgLight: 'bg-emerald-500/10' },
  'Dining': { bg: 'bg-rose-500', text: 'text-rose-400', bgLight: 'bg-rose-500/10' },
  'Bills & Utilities': { bg: 'bg-amber-500', text: 'text-amber-400', bgLight: 'bg-amber-500/10' },
  'Subscriptions': { bg: 'bg-violet-500', text: 'text-violet-400', bgLight: 'bg-violet-500/10' },
  'Gas & Transport': { bg: 'bg-orange-500', text: 'text-orange-400', bgLight: 'bg-orange-500/10' },
  'Shopping': { bg: 'bg-cyan-500', text: 'text-cyan-400', bgLight: 'bg-cyan-500/10' },
  'Health': { bg: 'bg-pink-500', text: 'text-pink-400', bgLight: 'bg-pink-500/10' },
  'Housing': { bg: 'bg-blue-500', text: 'text-blue-400', bgLight: 'bg-blue-500/10' },
  'Cash & ATM': { bg: 'bg-yellow-500', text: 'text-yellow-400', bgLight: 'bg-yellow-500/10' },
  'Donations': { bg: 'bg-teal-500', text: 'text-teal-400', bgLight: 'bg-teal-500/10' },
  'Insurance': { bg: 'bg-sky-500', text: 'text-sky-400', bgLight: 'bg-sky-500/10' },
  'Travel': { bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', bgLight: 'bg-fuchsia-500/10' },
  'Investments': { bg: 'bg-lime-500', text: 'text-lime-400', bgLight: 'bg-lime-500/10' },
  'International Transfers': { bg: 'bg-indigo-500', text: 'text-indigo-400', bgLight: 'bg-indigo-500/10' },
  'Other': { bg: 'bg-slate-500', text: 'text-slate-400', bgLight: 'bg-slate-500/10' },
}

export const CATEGORY_HEX = {
  'Groceries': '#10B981',
  'Dining': '#F43F5E',
  'Bills & Utilities': '#F59E0B',
  'Subscriptions': '#8B5CF6',
  'Gas & Transport': '#F97316',
  'Shopping': '#06B6D4',
  'Health': '#EC4899',
  'Housing': '#3B82F6',
  'Cash & ATM': '#EAB308',
  'Donations': '#14B8A6',
  'Insurance': '#0EA5E9',
  'Travel': '#D946EF',
  'Investments': '#84CC16',
  'International Transfers': '#6366F1',
  'Other': '#64748B',
}

/**
 * Compares spending between two months, returning changes per category.
 */
export function computeMonthDiff(currentByCategory, previousByCategory) {
  const allCategories = new Set([
    ...Object.keys(currentByCategory),
    ...Object.keys(previousByCategory),
  ])

  const diffs = []

  for (const cat of allCategories) {
    const current = currentByCategory[cat]?.total || 0
    const previous = previousByCategory[cat]?.total || 0
    const change = current - previous
    const pctChange = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0

    diffs.push({
      category: cat,
      current,
      previous,
      change,
      pctChange,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    })
  }

  return diffs.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

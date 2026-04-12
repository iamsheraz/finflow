import { createContext, useContext, useState, useEffect } from 'react'
import { db } from '@/db/index'

const MonthContext = createContext()

export function MonthProvider({ children }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [initialized, setInitialized] = useState(false)

  // Detect the latest month that has transaction data
  const detectLatestMonth = () => {
    db.transactions.orderBy('date').last().then(latest => {
      if (latest) {
        const d = new Date(latest.date)
        setYear(d.getFullYear())
        setMonth(d.getMonth() + 1)
      }
      setInitialized(true)
    }).catch(() => setInitialized(true))
  }

  useEffect(() => {
    if (!initialized) detectLatestMonth()
  }, [initialized])

  // Re-detect when transactions change (e.g., after import)
  useEffect(() => {
    const sub = db.transactions.hook('creating', () => {})
    // Listen for DB changes via a simple poll after bulk operations
    const handler = () => detectLatestMonth()
    window.addEventListener('finflow:data-imported', handler)
    return () => {
      window.removeEventListener('finflow:data-imported', handler)
    }
  }, [])

  const setMonthYear = (m, y) => {
    setMonth(m)
    setYear(y)
  }

  const label = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Generate last 24 months for selector
  const options = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    })
  }

  return (
    <MonthContext.Provider value={{ year, month, setMonthYear, label, options }}>
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const ctx = useContext(MonthContext)
  if (!ctx) throw new Error('useMonth must be used within MonthProvider')
  return ctx
}

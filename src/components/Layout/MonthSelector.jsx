import { useMonth } from '@/hooks/useMonth'
import { useTheme } from '@/hooks/useTheme'

export default function MonthSelector() {
  const { year, month, setMonthYear, options } = useMonth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <select
      value={`${year}-${month}`}
      onChange={(e) => {
        const [y, m] = e.target.value.split('-').map(Number)
        setMonthYear(m, y)
      }}
      className={`border rounded-lg px-3 py-1.5 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary ${
        isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}
    >
      {options.map(opt => (
        <option
          key={`${opt.year}-${opt.month}`}
          value={`${opt.year}-${opt.month}`}
          className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}
        >
          {opt.label}
        </option>
      ))}
    </select>
  )
}

import { useTheme } from '@/hooks/useTheme'

export default function Card({ children, className = '', onClick }) {
  const { theme } = useTheme()

  return (
    <div
      onClick={onClick}
      className={`
        card rounded-xl border
        ${theme === 'dark' ? 'bg-brand-card border-brand-border' : 'bg-white border-slate-200'}
        ${onClick ? 'cursor-pointer hover:border-brand-secondary/30 transition-colors' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

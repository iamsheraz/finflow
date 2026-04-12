import { useTheme } from '@/hooks/useTheme'

export default function PageHeader({ breadcrumb, title, children }) {
  const { theme } = useTheme()

  return (
    <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-brand-border' : 'border-slate-200'}`}>
      <div>
        <div className={`flex items-center gap-2 text-xs mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          <span>Dashboard</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{breadcrumb}</span>
        </div>
        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

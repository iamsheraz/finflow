import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import {
  LayoutDashboard, Upload, ArrowLeftRight, BarChart3, CreditCard,
  CircleDollarSign, Gift, Columns3, Lightbulb, Settings, Moon, Sun,
  RefreshCw, Target,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/transfers', icon: ArrowLeftRight, label: 'Transfers' },
  { to: '/spending', icon: BarChart3, label: 'Spending' },
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/budgets', icon: Target, label: 'Budgets' },
  { to: '/utilization', icon: CreditCard, label: 'Credit Cards' },
  { to: '/networth', icon: CircleDollarSign, label: 'Net Worth' },
  { to: '/income', icon: Gift, label: 'Income' },
  { to: '/gaps', icon: Columns3, label: 'Gaps', badge: null },
  { to: '/suggestions', icon: Lightbulb, label: 'Suggestions', badge: null },
]

export default function Sidebar({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        sidebar fixed left-0 top-0 w-64 h-screen z-50 flex flex-col
        border-r transition-transform duration-300
        ${theme === 'dark' ? 'bg-brand-bg border-brand-border' : 'bg-white border-slate-200'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`px-5 py-5 flex items-center gap-3 border-b ${theme === 'dark' ? 'border-brand-border' : 'border-slate-200'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h1 className={`font-bold text-lg tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>FinFlow</h1>
            <p className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Personal Finance</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, badge }) => {
            const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
            const activeExact = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-l-lg text-sm font-medium cursor-pointer transition-colors
                  ${activeExact
                    ? `${theme === 'dark' ? 'bg-brand-primary/20 text-brand-secondary' : 'bg-brand-primary/10 text-brand-primary'} border-r-[3px] border-brand-secondary`
                    : `${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`
                  }
                `}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {label}
                {badge !== undefined && badge !== null && (
                  <span className="ml-auto bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className={`px-3 py-3 border-t space-y-0.5 ${theme === 'dark' ? 'border-brand-border' : 'border-slate-200'}`}>
          <NavLink
            to="/settings"
            onClick={onClose}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-l-lg text-sm font-medium cursor-pointer transition-colors
              ${location.pathname === '/settings'
                ? `${theme === 'dark' ? 'bg-brand-primary/20 text-brand-secondary' : 'bg-brand-primary/10 text-brand-primary'} border-r-[3px] border-brand-secondary`
                : `${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`
              }
            `}
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={1.8} />
            Settings
          </NavLink>
          <div className="flex items-center gap-3 px-3 py-2 mt-2">
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Local-first</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

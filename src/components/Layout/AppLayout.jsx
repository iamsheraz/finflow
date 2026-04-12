import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useTheme } from '@/hooks/useTheme'
import { Menu, Moon, Sun } from 'lucide-react'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen">
      {/* Mobile Header */}
      <header className={`
        md:hidden fixed top-0 left-0 right-0 z-30 px-4 py-3 flex items-center justify-between border-b
        ${theme === 'dark' ? 'bg-brand-bg border-brand-border' : 'bg-white border-slate-200'}
      `}>
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-sm">FinFlow</span>
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="md:ml-64 pt-14 md:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}

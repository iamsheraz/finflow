import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { MonthProvider } from '@/hooks/useMonth'
import AppLayout from '@/components/Layout/AppLayout'
import Overview from '@/pages/Overview'
import UploadPage from '@/pages/UploadPage'
import TransfersPage from '@/pages/TransfersPage'
import SpendingPage from '@/pages/SpendingPage'
import UtilizationPage from '@/pages/UtilizationPage'
import NetWorthPage from '@/pages/NetWorthPage'
import IncomePage from '@/pages/IncomePage'
import GapsPage from '@/pages/GapsPage'
import SuggestionsPage from '@/pages/SuggestionsPage'
import RecurringPage from '@/pages/RecurringPage'
import BudgetPage from '@/pages/BudgetPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <MonthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/spending" element={<SpendingPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/budgets" element={<BudgetPage />} />
            <Route path="/utilization" element={<UtilizationPage />} />
            <Route path="/networth" element={<NetWorthPage />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/gaps" element={<GapsPage />} />
            <Route path="/suggestions" element={<SuggestionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </MonthProvider>
    </ThemeProvider>
  )
}

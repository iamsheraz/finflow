import { useState, useEffect, createContext, useContext } from 'react'
import { preferencesRepo } from '@/db/preferences'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark')

  useEffect(() => {
    preferencesRepo.getTheme().then(t => {
      setThemeState(t)
      document.body.classList.toggle('dark', t === 'dark')
    })
  }, [])

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    document.body.classList.toggle('dark', newTheme === 'dark')
    preferencesRepo.setTheme(newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

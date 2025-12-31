import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { appConfig } from '../config/app.config'

type Theme = 'light' | 'dark'
type Layout = 'boxed' | 'full-width'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  primaryColor: string
  setPrimaryColor: (color: string) => void
  toggleTheme: () => void
  layout: Layout
  setLayout: (layout: Layout) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme
    return stored || appConfig.theme.defaultMode
  })

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    return localStorage.getItem('primaryColor') || appConfig.theme.defaultColor
  })

  const [layout, setLayout] = useState<Layout>(() => {
    const stored = localStorage.getItem('layout') as Layout
    return stored || 'boxed'
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    const colorConfig = appConfig.theme.availableColors.find(c => c.value === primaryColor)
    
    if (colorConfig) {
      // Extract just the oklch values without 'oklch()' wrapper
      const oklchValue = colorConfig.class.replace('oklch(', '').replace(')', '')
      
      // Set the CSS custom property for primary color
      root.style.setProperty('--primary', oklchValue)
      
      // Also update primary-foreground for proper contrast
      if (theme === 'dark') {
        root.style.setProperty('--primary-foreground', '0.205 0 0') // dark background
      } else {
        root.style.setProperty('--primary-foreground', '0.985 0 0') // light foreground
      }
    }
    
    localStorage.setItem('primaryColor', primaryColor)
  }, [primaryColor, theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    localStorage.setItem('layout', layout)
  }, [layout])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, primaryColor, setPrimaryColor, toggleTheme, layout, setLayout }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 transition-all duration-150 cursor-not-allowed opacity-50'
        )}
      >
        <div className="w-4 h-4 bg-muted-foreground/20 rounded-full animate-pulse" />
        {!collapsed && <div className="h-4 w-16 bg-muted-foreground/15 rounded animate-pulse" />}
      </button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-accent hover:text-foreground transition-all duration-150 group'
      )}
      title={collapsed ? (isDark ? 'Light Mode' : 'Dark Mode') : undefined}
    >
      {isDark ? (
        <Sun className="flex-shrink-0 w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
      ) : (
        <Moon className="flex-shrink-0 w-4 h-4" />
      )}
      {!collapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  )
}

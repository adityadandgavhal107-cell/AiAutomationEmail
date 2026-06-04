'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, Megaphone, CheckCircle2, XCircle, Clock, Loader2, X } from 'lucide-react'

interface TopbarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

interface Notification {
  id: string
  title: string
  description: string
  time: string
  type: 'success' | 'error' | 'info' | 'pending'
}

export function Topbar({ title, subtitle, children }: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  // Fetch recent campaigns as notifications when panel opens
  useEffect(() => {
    if (!showNotifications) return
    setLoading(true)
    fetch('/api/campaigns?limit=10')
      .then(r => {
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error('Not authenticated')
        return r.json()
      })
      .then(result => {
        const campaigns = result.data || []
        const mapped: Notification[] = campaigns.map((c: any) => {
          let type: Notification['type'] = 'info'
          let description = `Audience: ${(c.audience_type || 'all').replace('_', ' ')}`
          if (c.status === 'sent') {
            type = 'success'
            description = `${c.emails_sent || 0} emails delivered`
          } else if (c.status === 'failed') {
            type = 'error'
            description = 'Campaign delivery failed'
          } else if (c.status === 'sending') {
            type = 'pending'
            description = 'Currently sending...'
          } else {
            description = 'Draft — not sent yet'
          }

          const timeAgo = getRelativeTime(c.sent_at || c.created_at)

          return {
            id: c.id,
            title: c.name || 'Untitled Campaign',
            description,
            time: timeAgo,
            type,
          }
        })
        setNotifications(mapped)
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false))
  }, [showNotifications])

  const unreadCount = notifications.filter(n => n.type === 'success' || n.type === 'error').length

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending': return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowNotifications(prev => !prev)}
            className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-fade-in-up z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[340px]">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Campaign activity will appear here</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {typeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function getRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

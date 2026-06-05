'use client'

import { useState, useEffect, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  CalendarClock, Plus, Trash2, Send, Clock, CalendarDays,
  Loader2, AlertCircle, CheckCircle2, ChevronDown
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  audience_type: string
}

interface ScheduledItem {
  id: string
  campaignId: string
  campaignName: string
  scheduledDate: string // ISO datetime string
  scheduledTime: string // HH:MM
  status: 'pending' | 'sent' | 'cancelled'
  createdAt: string
}

const STORAGE_KEY = 'prosmart_scheduled_emails'

function loadSchedule(): ScheduledItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSchedule(items: ScheduledItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function formatDateTime(date: string, time: string): string {
  const dt = new Date(`${date}T${time}`)
  return dt.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getStatusConfig(status: ScheduledItem['status'], scheduledDate: string, scheduledTime: string) {
  const now = new Date()
  const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
  const isPast = scheduledAt < now

  if (status === 'sent') return { label: 'Sent', color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
  if (status === 'cancelled') return { label: 'Cancelled', color: 'text-muted-foreground bg-muted/50 border-border', icon: <AlertCircle className="w-3.5 h-3.5" /> }
  if (isPast) return { label: 'Overdue', color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: <AlertCircle className="w-3.5 h-3.5" /> }
  return { label: 'Scheduled', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: <Clock className="w-3.5 h-3.5" /> }
}

export default function SchedulePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [schedule, setSchedule] = useState<ScheduledItem[]>([])
  const [sending, setSending] = useState<string | null>(null)

  // Form state
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('09:00')
  const [showForm, setShowForm] = useState(false)

  // Load campaigns and schedule on mount
  useEffect(() => {
    setLoadingCampaigns(true)
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => {
        const all: Campaign[] = d.data || []
        // Only show draft campaigns in the picker
        setCampaigns(all.filter(c => c.status === 'draft'))
      })
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoadingCampaigns(false))

    setSchedule(loadSchedule())
  }, [])

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
  }, [])

  const handleAddSchedule = () => {
    if (!selectedCampaignId) { toast.error('Please select a campaign'); return }
    if (!selectedDate) { toast.error('Please select a date'); return }
    if (!selectedTime) { toast.error('Please select a time'); return }

    const scheduledAt = new Date(`${selectedDate}T${selectedTime}`)
    if (scheduledAt < new Date()) {
      toast.error('Cannot schedule in the past. Please pick a future date/time.')
      return
    }

    const campaign = campaigns.find(c => c.id === selectedCampaignId)
    if (!campaign) return

    const newItem: ScheduledItem = {
      id: crypto.randomUUID(),
      campaignId: selectedCampaignId,
      campaignName: campaign.name,
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    const updated = [...schedule, newItem].sort(
      (a, b) => new Date(`${a.scheduledDate}T${a.scheduledTime}`).getTime() - new Date(`${b.scheduledDate}T${b.scheduledTime}`).getTime()
    )
    setSchedule(updated)
    saveSchedule(updated)
    toast.success(`Scheduled "${campaign.name}" for ${formatDateTime(selectedDate, selectedTime)}`)
    setShowForm(false)
    setSelectedCampaignId('')
  }

  const handleCancel = (id: string) => {
    const updated = schedule.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s)
    setSchedule(updated)
    saveSchedule(updated)
    toast.success('Schedule cancelled')
  }

  const handleSendNow = useCallback(async (item: ScheduledItem) => {
    setSending(item.id)
    try {
      const res = await fetch(`/api/campaigns/${item.campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      const updated = schedule.map(s => s.id === item.id ? { ...s, status: 'sent' as const } : s)
      setSchedule(updated)
      saveSchedule(updated)
      toast.success(`✅ Sent! ${data.emailsSent || 0} emails delivered.`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send')
    } finally {
      setSending(null)
    }
  }, [schedule])

  const handleDelete = (id: string) => {
    const updated = schedule.filter(s => s.id !== id)
    setSchedule(updated)
    saveSchedule(updated)
    toast.success('Removed from schedule')
  }

  const pendingCount = schedule.filter(s => s.status === 'pending').length
  const sentCount = schedule.filter(s => s.status === 'sent').length

  const today = new Date().toISOString().split('T')[0]
  const minTime = selectedDate === today
    ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : '00:00'

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Email Schedule" subtitle="Plan and schedule your campaigns to send at the perfect time.">
        <Button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Schedule Campaign
        </Button>
      </Topbar>

      <div className="p-6 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Scheduled', value: pendingCount, icon: <Clock className="w-5 h-5 text-amber-500" />, color: 'text-amber-500' },
            { label: 'Sent', value: sentCount, icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, color: 'text-green-500' },
            { label: 'Draft Campaigns', value: campaigns.length, icon: <Send className="w-5 h-5 text-primary" />, color: 'text-primary' },
          ].map(stat => (
            <div key={stat.label} className="glass-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Schedule Form */}
        {showForm && (
          <div className="glass-card border border-primary/30 rounded-2xl p-6 space-y-5 bg-primary/3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold">New Scheduled Send</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Campaign Select */}
              <div className="space-y-1.5">
                <Label>Campaign</Label>
                {loadingCampaigns ? (
                  <div className="h-9 rounded-lg border border-border bg-muted/40 flex items-center px-3 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="h-9 rounded-lg border border-border bg-muted/40 flex items-center px-3 text-sm text-muted-foreground">
                    No draft campaigns
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedCampaignId}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                    >
                      <option value="">Select campaign...</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Date Picker */}
              <div className="space-y-1.5">
                <Label>Date</Label>
                <input
                  type="date"
                  value={selectedDate}
                  min={today}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                />
              </div>

              {/* Time Picker */}
              <div className="space-y-1.5">
                <Label>Time</Label>
                <input
                  type="time"
                  value={selectedTime}
                  min={minTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                />
              </div>
            </div>

            {selectedCampaignId && selectedDate && selectedTime && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Will send </span>
                <span className="font-semibold text-foreground">
                  &quot;{campaigns.find(c => c.id === selectedCampaignId)?.name}&quot;
                </span>
                <span className="text-muted-foreground"> on </span>
                <span className="font-semibold text-primary">{formatDateTime(selectedDate, selectedTime)}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleAddSchedule} className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Confirm Schedule
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Schedule Table */}
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Upcoming Schedule
            </h2>
            <span className="text-xs text-muted-foreground">{schedule.length} total</span>
          </div>

          {schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                <CalendarClock className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No scheduled sends yet</p>
                <p className="text-sm text-muted-foreground mt-1">Click &quot;Schedule Campaign&quot; to plan your next send</p>
              </div>
              <Button variant="outline" onClick={() => setShowForm(true)} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Now
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {schedule.map(item => {
                const cfg = getStatusConfig(item.status, item.scheduledDate, item.scheduledTime)
                const isPending = item.status === 'pending'
                return (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/20 transition-colors">
                    {/* Status dot */}
                    <div className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color}`}>
                      {cfg.icon}
                      {cfg.label}
                    </div>

                    {/* Campaign info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.campaignName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(item.scheduledDate, item.scheduledTime)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPending && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => handleSendNow(item)}
                          disabled={sending === item.id}
                          title="Send this campaign right now"
                        >
                          {sending === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <><Send className="w-3.5 h-3.5 mr-1" />Send Now</>
                          )}
                        </Button>
                      )}
                      {isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => handleCancel(item.id)}
                          title="Cancel this scheduled send"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(item.id)}
                        title="Remove from schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">How scheduling works</p>
            <p className="text-xs mt-0.5 text-blue-500/80 dark:text-blue-400/80">
              Scheduled sends are stored locally in your browser. When the scheduled time arrives, come back here and click
              <strong> &quot;Send Now&quot;</strong> to dispatch the campaign. Automatic background sending requires a server-side cron job (Vercel Cron or similar).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

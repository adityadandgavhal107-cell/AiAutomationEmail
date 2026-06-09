'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Campaign, CampaignStatus } from '@/types'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'
import {
  Plus, Megaphone, Send, Trash2, Clock, CheckCircle2, XCircle,
  Loader2, Calendar, InboxIcon, AlertCircle, ChevronRight
} from 'lucide-react'

const statusConfig: Record<CampaignStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: <Clock className="w-3 h-3" />, variant: 'secondary' },
  sending: { label: 'Sending / Queued', icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: 'default' },
  sent: { label: 'Sent', icon: <CheckCircle2 className="w-3 h-3" />, variant: 'outline' },
  failed: { label: 'Failed', icon: <XCircle className="w-3 h-3" />, variant: 'destructive' },
}

interface QueueInfo {
  totalPending: number
  batches: { date: string; count: number }[]
  sentToday: number
  dailyLimit: number
  remainingQuota: number
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sendingNextBatch, setSendingNextBatch] = useState<string | null>(null)
  const [queueData, setQueueData] = useState<Record<string, QueueInfo>>({})
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (!res.ok) throw new Error('Failed to fetch')
      const result = await res.json()
      setCampaigns(result.data || [])
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const fetchQueueForCampaign = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/queue`)
      if (!res.ok) return
      const data = await res.json()
      setQueueData(prev => ({ ...prev, [campaignId]: data }))
    } catch { /* ignore */ }
  }, [])

  // Fetch queue info for any campaign in 'sending' status
  useEffect(() => {
    campaigns
      .filter(c => c.status === 'sending')
      .forEach(c => fetchQueueForCampaign(c.id))
  }, [campaigns, fetchQueueForCampaign])

  const handleSend = async (id: string) => {
    if (!confirm('Send this campaign now? It will respect your daily Gmail limit and queue the rest automatically.')) return
    setSending(id)
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok && res.status !== 429) {
        let errMsg = 'Send failed'
        if (contentType.includes('application/json')) {
          const data = await res.json()
          errMsg = data.error || errMsg
        } else {
          const text = await res.text()
          errMsg = `Server error (${res.status}): ${text.substring(0, 150)}`
        }
        throw new Error(errMsg)
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response format from server (not JSON).')
      }
      const data = await res.json()

      if (res.status === 429) {
        toast.warning(`Daily email limit reached (${data.sentToday}/${data.dailyLimit}). ${data.queued} emails queued for tomorrow.`)
        fetchCampaigns()
        return
      }

      if (data.hasQueue) {
        toast.success(
          `✅ Sent ${data.emailsSent} emails today! 📬 ${data.queued} emails queued across ${data.daysToComplete - 1} more day(s).`
        )
      } else if (data.errorSummary) {
        toast.warning(`Sent with issues: ${data.emailsSent}/${data.totalLeads} delivered. ${data.errorSummary}`)
      } else {
        toast.success(`🎉 Campaign fully sent! ${data.emailsSent}/${data.totalLeads} emails delivered.`)
      }
      fetchCampaigns()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send campaign')
    } finally {
      setSending(null)
    }
  }

  const handleSendNextBatch = async (campaignId: string) => {
    setSendingNextBatch(campaignId)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/queue`, { method: 'POST' })
      const data = await res.json()

      if (res.status === 429) {
        toast.warning(`Daily limit reached (${data.sentToday}/${data.dailyLimit}). Try again tomorrow.`)
        return
      }

      if (!res.ok) throw new Error(data.error || 'Failed to send batch')

      if (data.campaignComplete) {
        toast.success(`🎉 Campaign fully complete! All emails delivered.`)
      } else if (data.errorSummary) {
        toast.warning(`Batch sent with issues: ${data.emailsSent} delivered. ${data.errorSummary}`)
      } else {
        toast.success(`✅ Sent ${data.emailsSent} emails in this batch!`)
      }

      fetchCampaigns()
      fetchQueueForCampaign(campaignId)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send next batch')
    } finally {
      setSendingNextBatch(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign permanently?')) return
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Campaign deleted')
      fetchCampaigns()
    } catch {
      toast.error('Failed to delete campaign')
    }
  }

  if (showWizard) {
    return (
      <CampaignWizard
        onClose={() => setShowWizard(false)}
        onComplete={() => {
          setShowWizard(false)
          fetchCampaigns()
        }}
      />
    )
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Campaigns" subtitle="Send AI-powered email campaigns with smart daily batching.">
        <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center glass-card rounded-2xl border border-border">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No campaigns yet</h3>
              <p className="text-muted-foreground text-sm mt-1">Create your first AI-powered email campaign</p>
            </div>
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const status = statusConfig[campaign.status]
              const queue = queueData[campaign.id]
              const isQueued = campaign.status === 'sending' && queue && queue.totalPending > 0

              return (
                <div key={campaign.id} className="glass-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-all duration-200">
                  {/* Main Row */}
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{campaign.name}</h3>
                        <Badge variant={status.variant} className="flex items-center gap-1 text-xs">
                          {status.icon}
                          {status.label}
                        </Badge>
                        {isQueued && (
                          <Badge variant="outline" className="flex items-center gap-1 text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                            <InboxIcon className="w-3 h-3" />
                            {queue.totalPending} queued
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>Audience: <span className="capitalize">{campaign.audience_type.replace('_', ' ')}</span></span>
                        {campaign.emails_sent > 0 && (
                          <span className="flex items-center gap-1">
                            <Send className="w-3 h-3" />
                            {campaign.emails_sent} sent
                          </span>
                        )}
                        {isQueued && queue && (
                          <span className="text-amber-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {queue.batches.length} more day(s) scheduled
                          </span>
                        )}
                        <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Daily quota bar for queued campaigns */}
                      {isQueued && queue && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                            <span>Today's quota: {queue.sentToday}/{queue.dailyLimit} sent</span>
                            <span>{queue.remainingQuota} remaining today</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(100, (queue.sentToday / queue.dailyLimit) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Send button for draft campaigns */}
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(campaign.id)}
                          disabled={sending === campaign.id}
                        >
                          {sending === campaign.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              Send
                            </>
                          )}
                        </Button>
                      )}

                      {/* Send Next Batch button for queued campaigns */}
                      {isQueued && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                          onClick={() => handleSendNextBatch(campaign.id)}
                          disabled={sendingNextBatch === campaign.id || (queue?.remainingQuota ?? 0) === 0}
                          title={queue?.remainingQuota === 0 ? 'Daily limit reached — try again tomorrow' : 'Send next queued batch'}
                        >
                          {sendingNextBatch === campaign.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <InboxIcon className="w-4 h-4 mr-1" />
                              Send Next Batch
                            </>
                          )}
                        </Button>
                      )}

                      {/* Expand queue details toggle */}
                      {isQueued && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedQueue(expandedQueue === campaign.id ? null : campaign.id)}
                          title="View queue details"
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedQueue === campaign.id ? 'rotate-90' : ''}`} />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Queue Details Panel */}
                  {isQueued && expandedQueue === campaign.id && queue && (
                    <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        <Calendar className="w-3.5 h-3.5" />
                        Scheduled Batches
                      </div>
                      {queue.batches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No pending batches.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {queue.batches.map((batch, i) => (
                            <div key={batch.date} className="flex items-center justify-between bg-card/60 border border-border rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-amber-500">{i + 2}</span>
                                </div>
                                <div>
                                  <p className="text-xs font-medium">
                                    {new Date(batch.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{batch.count} emails</p>
                                </div>
                              </div>
                              {i === 0 && (
                                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">Next</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {queue.remainingQuota === 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          Daily limit reached. The next batch can be sent tomorrow.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

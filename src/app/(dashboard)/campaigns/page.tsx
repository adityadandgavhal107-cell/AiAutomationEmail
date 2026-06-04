'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Plus, Megaphone, Send, Trash2, Clock, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Campaign, CampaignStatus } from '@/types'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'

const statusConfig: Record<CampaignStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: <Clock className="w-3 h-3" />, variant: 'secondary' },
  sending: { label: 'Sending', icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: 'default' },
  sent: { label: 'Sent', icon: <CheckCircle2 className="w-3 h-3" />, variant: 'outline' },
  failed: { label: 'Failed', icon: <XCircle className="w-3 h-3" />, variant: 'destructive' },
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

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

  const handleSend = async (id: string) => {
    if (!confirm('Send this campaign to all recipients now?')) return
    setSending(id)
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Session expired. Please refresh the page and log in again.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      if (data.errorSummary) {
        toast.warning(`Campaign sent with issues: ${data.emailsSent}/${data.total} delivered. ${data.errorSummary}`)
      } else {
        toast.success(`Campaign sent! ${data.emailsSent}/${data.total} emails delivered.`)
      }
      fetchCampaigns()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send campaign')
    } finally {
      setSending(null)
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
      <Topbar title="Campaigns" subtitle="Create AI-powered email campaigns and track delivery.">
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
              return (
                <div
                  key={campaign.id}
                  className="glass-card rounded-xl border border-border p-5 flex items-center gap-4 hover:border-primary/30 transition-all duration-200"
                >
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
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span>Audience: <span className="capitalize">{campaign.audience_type.replace('_', ' ')}</span></span>
                      {campaign.emails_sent > 0 && (
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          {campaign.emails_sent} sent
                        </span>
                      )}
                      <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

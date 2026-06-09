'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Check, Loader2, Wand2, Users, FileText,
  Package, Mail, Paperclip, Eye, Send, X, Search, Calendar, InboxIcon
} from 'lucide-react'
import type { AiTone, AiLength, Lead, Template, Product } from '@/types'

const DAILY_LIMIT = parseInt(process.env.NEXT_PUBLIC_EMAIL_DAILY_LIMIT || '450', 10)

const STEPS = [
  { id: 1, label: 'Name', icon: FileText },
  { id: 2, label: 'Audience', icon: Users },
  { id: 3, label: 'Template', icon: FileText },
  { id: 4, label: 'Product', icon: Package },
  { id: 5, label: 'AI Generate', icon: Wand2 },
  { id: 6, label: 'Review', icon: Eye },
  { id: 7, label: 'Send', icon: Send },
]

const TONES: { value: AiTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'startup', label: 'Startup' },
  { value: 'direct', label: 'Direct' },
]

const LENGTHS: { value: AiLength; label: string; desc: string }[] = [
  { value: 'short', label: 'Short', desc: '~100 words' },
  { value: 'medium', label: 'Medium', desc: '~200 words' },
  { value: 'long', label: 'Long', desc: '~350 words' },
]

type AudienceType = 'all' | 'potential_customers' | 'selected'

interface CampaignWizardProps {
  onClose: () => void
  onComplete: () => void
}

// Helper: calculate batch schedule for N leads
function calcBatches(totalLeads: number): { day: number; count: number; label: string }[] {
  if (totalLeads === 0) return []
  const batches = []
  let remaining = totalLeads
  let day = 1
  while (remaining > 0) {
    const count = Math.min(remaining, DAILY_LIMIT)
    batches.push({
      day,
      count,
      label: day === 1 ? 'Today' : day === 2 ? 'Tomorrow' : `Day ${day}`,
    })
    remaining -= count
    day++
  }
  return batches
}

export function CampaignWizard({ onClose, onComplete }: CampaignWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)

  // Step 1
  const [name, setName] = useState('')

  // Step 2 - Audience
  const [audienceType, setAudienceType] = useState<AudienceType>('all')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [leadSearch, setLeadSearch] = useState('')
  const [leadsLoading, setLeadsLoading] = useState(false)

  // Step 3 - Template
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Step 4 - Product
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Step 5 - AI
  const [tone, setTone] = useState<AiTone>('professional')
  const [aiLength, setAiLength] = useState<AiLength>('medium')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<{ filename: string, content: string }[]>([])
  const [previewLead, setPreviewLead] = useState<Lead | null>(null)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d.data || []))
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.data || []))
    setLeadsLoading(true)
    fetch('/api/leads?limit=5000').then(r => r.json()).then(d => {
      const all = d.data || []
      setLeads(all)
      if (all.length > 0) setPreviewLead(all[0])
    }).finally(() => setLeadsLoading(false))
  }, [])

  // Leads to display in picker (filtered by search)
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads
    const q = leadSearch.toLowerCase()
    return leads.filter(l =>
      l.email.toLowerCase().includes(q) ||
      `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase().includes(q) ||
      (l.organization_name || '').toLowerCase().includes(q)
    )
  }, [leads, leadSearch])

  // Effective audience list
  const audienceLeads = useMemo(() => {
    if (audienceType === 'all') return leads
    if (audienceType === 'potential_customers') return leads.filter(l => l.status === 'potential_customer')
    return leads.filter(l => selectedLeadIds.has(l.id))
  }, [audienceType, leads, selectedLeadIds])

  const audienceCount = audienceLeads.length
  const batches = calcBatches(audienceCount)

  const toggleLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAllFiltered = () => {
    const allIds = new Set(filteredLeads.map(l => l.id))
    const allSelected = filteredLeads.every(l => selectedLeadIds.has(l.id))
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        allIds.forEach(id => next.delete(id))
      } else {
        allIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0
    if (step === 2 && audienceType === 'selected') return selectedLeadIds.size > 0
    if (step === 5) return subject.trim().length > 0 && body.trim().length > 0
    return true
  }

  const handleGenerate = async () => {
    if (!previewLead) { toast.error('No lead found for preview'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: previewLead,
          product: selectedProduct || null,
          template: selectedTemplate || null,
          tone,
          length: aiLength,
        }),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) {
        let errMsg = 'Generation failed'
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
      setSubject(data.subject)
      setBody(data.body)
      toast.success('Email generated!')
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveDraft = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          audience_type: audienceType,
          template_id: selectedTemplate?.id || null,
          product_id: selectedProduct?.id || null,
          ai_tone: tone,
          ai_length: aiLength,
          subject: subject || null,
          body: body || null,
          selected_lead_ids: audienceType === 'selected' ? Array.from(selectedLeadIds) : undefined,
        }),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) {
        let errMsg = 'Failed to save campaign'
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
      setCampaignId(data.id)
      return data.id
    } catch (err: any) {
      toast.error(err.message || 'Failed to save campaign')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      let id = campaignId
      if (!id) {
        id = await handleSaveDraft()
        if (!id) return
      }
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: attachments.length > 0 ? attachments : undefined })
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok && res.status !== 429) {
        let errMsg = 'Failed to send campaign'
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
        toast.warning(`Daily limit reached. ${data.queued} emails queued for tomorrow.`)
        onComplete()
        return
      }

      if (data.hasQueue) {
        toast.success(`✅ Sent ${data.emailsSent} today! 📬 ${data.queued} emails queued across ${data.daysToComplete - 1} more day(s).`)
      } else if (data.errorSummary) {
        toast.warning(`Sent with issues: ${data.emailsSent}/${data.totalLeads} delivered.`)
      } else {
        toast.success(`🎉 Campaign sent! ${data.emailsSent}/${data.totalLeads} emails delivered.`)
      }
      onComplete()
    } catch (err: any) {
      toast.error(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleNext = async () => {
    if (step === 6) {
      const id = await handleSaveDraft()
      if (id) setStep(7)
      return
    }
    setStep(s => s + 1)
  }

  return (
    <div className="animate-fade-in-up flex flex-col h-screen max-h-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">New Campaign</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = s.id === step
            const isDone = s.id < step
            return (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground' :
                    isDone ? 'bg-primary/20 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="max-w-lg space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Name your campaign</h2>
              <p className="text-sm text-muted-foreground mt-1">Give your campaign a clear, descriptive name.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name *</Label>
              <Input
                id="campaign-name"
                placeholder="e.g. Q1 Product Launch Outreach"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Select your audience</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose who will receive this campaign.</p>
            </div>

            {/* Audience type buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: 'all' as const, label: 'All Leads', desc: `${leads.length} leads`, icon: Users },
                { value: 'potential_customers' as const, label: 'Potential Customers', desc: `${leads.filter(l => l.status === 'potential_customer').length} leads`, icon: Mail },
                { value: 'selected' as const, label: 'Hand-Pick Leads', desc: 'Choose specific people', icon: Check },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudienceType(opt.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    audienceType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Hand-pick lead selector */}
            {audienceType === 'selected' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleAllFiltered}
                      className="text-xs h-7"
                    >
                      {filteredLeads.every(l => selectedLeadIds.has(l.id)) ? 'Deselect All' : 'Select All Shown'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedLeadIds(new Set())}
                      className="text-xs h-7 text-destructive"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name, email or company..."
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                  />
                </div>

                {/* Lead list */}
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-border">
                    {filteredLeads.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">No leads match your search.</div>
                    ) : (
                      filteredLeads.map(lead => {
                        const checked = selectedLeadIds.has(lead.id)
                        return (
                          <button
                            key={lead.id}
                            onClick={() => toggleLead(lead.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors ${checked ? 'bg-primary/5' : ''}`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                              checked ? 'bg-primary border-primary' : 'border-border'
                            }`}>
                              {checked && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {lead.first_name || lead.last_name
                                  ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                  : lead.email}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                            </div>
                            {lead.organization_name && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[120px]">
                                {lead.organization_name}
                              </span>
                            )}
                            {lead.status === 'potential_customer' && (
                              <Badge variant="outline" className="text-[10px] flex-shrink-0 text-primary border-primary/30">
                                Potential
                              </Badge>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Batch preview info */}
            {audienceCount > 0 && (
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="w-4 h-4 text-primary" />
                  Sending Schedule Preview
                </div>
                <div className="flex flex-wrap gap-2">
                  {batches.map(b => (
                    <div key={b.day} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      b.day === 1
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      <InboxIcon className="w-3 h-3" />
                      {b.label}: {b.count} emails
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {audienceCount} emails split across {batches.length} day(s) · {DAILY_LIMIT}/day limit
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Template */}
        {step === 3 && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Choose a template (optional)</h2>
              <p className="text-sm text-muted-foreground mt-1">Select a base template or skip to use AI generation only.</p>
            </div>
            <div className="grid gap-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  !selectedTemplate ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="font-medium">No template — AI only</div>
                <div className="text-sm text-muted-foreground">Let AI create the email from scratch</div>
              </button>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground capitalize px-2 py-0.5 bg-muted rounded-full">
                      {t.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {t.subject && <div className="text-sm text-muted-foreground mt-1 truncate">Subject: {t.subject}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Product */}
        {step === 4 && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Attach a product (optional)</h2>
              <p className="text-sm text-muted-foreground mt-1">Include product context so the AI can personalize the pitch.</p>
            </div>
            <div className="grid gap-3">
              <button
                onClick={() => setSelectedProduct(null)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  !selectedProduct ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="font-medium">No product</div>
                <div className="text-sm text-muted-foreground">General outreach without product pitch</div>
              </button>
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedProduct?.id === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  {p.description && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: AI Generate */}
        {step === 5 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold">AI Email Generation</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure tone and length, then generate your email.</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        tone === t.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Length</Label>
                <div className="flex gap-3">
                  {LENGTHS.map(l => (
                    <button
                      key={l.value}
                      onClick={() => setAiLength(l.value)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                        aiLength === l.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="font-medium">{l.label}</div>
                      <div className="text-xs text-muted-foreground">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {previewLead && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                  Preview lead: <span className="font-medium">{previewLead.first_name || ''} {previewLead.last_name || ''} ({previewLead.email})</span>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" />Generate with AI</>
                )}
              </Button>
            </div>

            {(subject || body) && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email-subject">Subject Line *</Label>
                  <Input
                    id="email-subject"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-body">Email Body *</Label>
                  <Textarea
                    id="email-body"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder="Email body..."
                  />
                </div>
                <div className="space-y-1.5 pt-2">
                  <Label>Attachments (Optional)</Label>
                  <Input
                    type="file"
                    multiple
                    className="cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files) {
                        Array.from(e.target.files).forEach(file => {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const base64 = (event.target?.result as string).split(',')[1]
                            setAttachments(prev => [...prev, { filename: file.name, content: base64 }])
                          }
                          reader.readAsDataURL(file)
                        })
                      }
                      e.target.value = ''
                    }}
                  />
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-muted/50 border border-border px-2 py-1.5 rounded-md text-xs">
                          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[150px] font-medium">{a.filename}</span>
                          <button
                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Review Campaign</h2>
              <p className="text-sm text-muted-foreground mt-1">Check your campaign details before sending.</p>
            </div>

            <div className="glass-card rounded-xl border border-border divide-y divide-border">
              {[
                { label: 'Campaign Name', value: name },
                {
                  label: 'Audience',
                  value: audienceType === 'selected'
                    ? `${selectedLeadIds.size} hand-picked leads`
                    : `${audienceType.replace('_', ' ')} (${audienceCount} leads)`
                },
                { label: 'Template', value: selectedTemplate?.name || 'None (AI only)' },
                { label: 'Product', value: selectedProduct?.name || 'None' },
                { label: 'Tone', value: tone },
                { label: 'Length', value: aiLength },
                { label: 'Estimated days', value: `${batches.length} day(s)` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium capitalize">{item.value}</span>
                </div>
              ))}
            </div>

            {subject && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Preview</div>
                <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-lg bg-card/40 backdrop-blur-md">
                  {/* Email Header */}
                  <div className="bg-muted/40 px-5 py-4 border-b border-border space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground w-16 flex-shrink-0">From:</span>
                      <span className="text-foreground font-semibold">Prosmart Concepts</span>
                      <span className="text-xs text-muted-foreground font-mono">&lt;onboarding@resend.dev&gt;</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground w-16 flex-shrink-0">To:</span>
                      <span className="text-foreground">
                        {previewLead 
                          ? `${previewLead.first_name || ''} ${previewLead.last_name || ''} <${previewLead.email}>`.trim()
                          : 'recipient@company.com'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <span className="font-medium text-muted-foreground w-16 flex-shrink-0">Subject:</span>
                      <span className="font-semibold text-foreground">{subject}</span>
                    </div>
                  </div>
                  
                  {/* Email Body */}
                  <div className="p-6 bg-card/25 min-h-[200px] max-h-80 overflow-y-auto">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 font-sans">
                      {(() => {
                        let processed = body
                        const replacements = [
                          { regex: /\[Your Name\]/gi, value: 'Aditya Dandgavhal' },
                          { regex: /\[Your Job Title\]/gi, value: 'Founder' },
                          { regex: /\[Your Company\]/gi, value: 'Prosmart Concepts' },
                          { regex: /\[Your Phone Number\]/gi, value: '' },
                          { regex: /\[Your Phone\]/gi, value: '' },
                          { regex: /\[Sender Name\]/gi, value: 'Aditya Dandgavhal' },
                          { regex: /\[Sender Job Title\]/gi, value: 'Founder' },
                          { regex: /\[Sender Company\]/gi, value: 'Prosmart Concepts' },
                        ]
                        replacements.forEach(r => {
                          processed = processed.replace(r.regex, r.value)
                        })
                        return processed
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Send */}
        {step === 7 && (
          <div className="max-w-lg space-y-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Ready to launch!</h2>
              <p className="text-muted-foreground mt-2">
                Campaign <span className="font-semibold text-foreground">&quot;{name}&quot;</span> will send to{' '}
                <span className="font-semibold text-foreground">{audienceCount} leads</span>.
              </p>
            </div>

            {/* Batch breakdown */}
            {batches.length > 0 && (
              <div className="w-full bg-muted/40 border border-border rounded-xl p-4 space-y-3 text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Sending Schedule
                </div>
                <div className="space-y-2">
                  {batches.map(b => (
                    <div key={b.day} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${b.day === 1 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        <span className={b.day === 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          {b.label}
                        </span>
                      </div>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${b.day === 1 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {b.count} emails
                      </span>
                    </div>
                  ))}
                </div>
                {batches.length > 1 && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    💡 After today&apos;s batch is sent, go to <strong>Campaigns</strong> and click <strong>"Send Next Batch"</strong> each day.
                  </p>
                )}
              </div>
            )}

            {!subject && (
              <p className="text-sm text-amber-500">
                ⚠️ No pre-generated email — AI will generate per lead during sending.
              </p>
            )}

            <Button size="lg" onClick={handleSend} disabled={sending} className="w-full max-w-xs">
              {sending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending batch 1...</>
              ) : (
                <><Send className="w-5 h-5 mr-2" />Send {Math.min(audienceCount, DAILY_LIMIT)} Emails Now</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {batches.length > 1
                ? `Sends ${batches[0].count} now. Remaining ${audienceCount - batches[0].count} queued automatically.`
                : 'This action cannot be undone. Emails will be sent immediately.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border px-6 py-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => step === 1 ? onClose() : setStep(s => s - 1)}
          disabled={loading || sending}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 7 && (
          <Button onClick={handleNext} disabled={!canProceed() || loading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <>{step === 6 ? 'Save & Continue' : 'Next'}<ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

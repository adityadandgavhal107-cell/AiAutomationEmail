'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Check, Loader2, Wand2, Users, FileText,
  Package, Mail, Paperclip, Eye, Send, X
} from 'lucide-react'
import type { AiTone, AiLength, Lead, Template, Product } from '@/types'

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

interface CampaignWizardProps {
  onClose: () => void
  onComplete: () => void
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
  const [audienceType, setAudienceType] = useState<'all' | 'potential_customers'>('all')
  const [leads, setLeads] = useState<Lead[]>([])

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
    fetch('/api/leads?limit=100').then(r => r.json()).then(d => {
      const all = d.data || []
      setLeads(all)
      if (all.length > 0) setPreviewLead(all[0])
    })
  }, [])

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0
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
      if (!contentType.includes('application/json')) {
        throw new Error('Session expired. Please refresh the page and log in again.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
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
        }),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Session expired. Please refresh the page and log in again.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
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
      if (!contentType.includes('application/json')) {
        throw new Error('Session expired. Please refresh the page and log in again.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.errorSummary) {
        toast.warning(`Campaign sent with issues: ${data.emailsSent}/${data.total} delivered. ${data.errorSummary}`)
      } else {
        toast.success(`🎉 Campaign sent! ${data.emailsSent}/${data.total} emails delivered.`)
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
      // Save draft before review-to-send
      const id = await handleSaveDraft()
      if (id) setStep(7)
      return
    }
    setStep(s => s + 1)
  }

  const audienceCount = audienceType === 'all'
    ? leads.length
    : leads.filter(l => l.status === 'potential_customer').length

  return (
    <div className="animate-fade-in-up flex flex-col h-full">
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
          <div className="max-w-lg space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Select your audience</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose who will receive this campaign.</p>
            </div>
            <div className="space-y-3">
              {([
                { value: 'all', label: 'All Leads', desc: `Send to all ${leads.length} leads` },
                { value: 'potential_customers', label: 'Potential Customers', desc: `Send to ${leads.filter(l => l.status === 'potential_customer').length} potential customers only` },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudienceType(opt.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    audienceType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
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

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
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
                      e.target.value = '' // reset input
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
                { label: 'Audience', value: `${audienceType.replace('_', ' ')} (${audienceCount} leads)` },
                { label: 'Template', value: selectedTemplate?.name || 'None (AI only)' },
                { label: 'Product', value: selectedProduct?.name || 'None' },
                { label: 'Tone', value: tone },
                { label: 'Length', value: aiLength },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium capitalize">{item.value}</span>
                </div>
              ))}
            </div>

            {subject && (
              <div className="space-y-3">
                <div className="glass-card rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-1">Subject Preview</div>
                  <div className="font-medium">{subject}</div>
                </div>
                <div className="glass-card rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground mb-2">Body Preview</div>
                  <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{body}</div>
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
                Your campaign <span className="font-semibold text-foreground">&quot;{name}&quot;</span> will be sent to{' '}
                <span className="font-semibold text-foreground">{audienceCount} leads</span>.
              </p>
              {!subject && (
                <p className="text-sm text-amber-500 mt-2">
                  ⚠️ No pre-generated email — AI will generate per lead during sending.
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleSend}
              disabled={sending}
              className="w-full max-w-xs"
            >
              {sending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending emails...</>
              ) : (
                <><Send className="w-5 h-5 mr-2" />Send Campaign Now</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. Emails will be sent immediately.
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
          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
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

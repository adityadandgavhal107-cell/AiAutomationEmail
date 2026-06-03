'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { type Template, type TemplateType } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Copy, Edit2, Trash2, Loader2, Calendar, Sparkles, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, getTemplateTypeLabel } from '@/lib/utils'

const TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'follow_up_1', label: 'Follow-Up 1' },
  { value: 'follow_up_2', label: 'Follow-Up 2' },
  { value: 'partnership_proposal', label: 'Partnership Proposal' },
  { value: 'product_demo', label: 'Product Demo' },
  { value: 'custom', label: 'Custom' },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<TemplateType>('cold_outreach')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      const result = await response.json()
      setTemplates(result.data || [])
    } catch (err) {
      toast.error('Failed to load templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setName('')
    setType('cold_outreach')
    setSubject('')
    setBody('')
    setOpen(true)
  }

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template)
    setName(template.name)
    setType(template.type)
    setSubject(template.subject || '')
    setBody(template.body || '')
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : '/api/templates'
      const method = editingTemplate ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, subject, body }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save template')

      toast.success(editingTemplate ? 'Template updated.' : 'Template created.')
      setOpen(false)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Could not save template.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete template')

      toast.success('Template deleted successfully.')
      fetchTemplates()
    } catch (err) {
      toast.error('Could not delete template.')
    }
  }

  const handleDuplicate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to duplicate template')

      toast.success('Template duplicated.')
      fetchTemplates()
    } catch (err) {
      toast.error('Could not duplicate template.')
    }
  }

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + ` {{${variable}}}`)
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Email Templates" subtitle="Draft structural guide templates for personalized outreach campaigns.">
        <Button onClick={handleOpenCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </Button>
      </Topbar>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="border-border/50 bg-card/40">
                <CardHeader>
                  <div className="h-4 w-1/4 bg-muted animate-pulse mb-3 rounded" />
                  <div className="h-5 w-2/3 bg-muted animate-pulse mb-2 rounded" />
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-16 text-center max-w-xl mx-auto mt-10 bg-card/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">No templates created yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Create email outreach templates. These serve as a structural base for the AI, ensuring consistent formatting while tailoring the actual content dynamically for each lead.
            </p>
            <Button onClick={handleOpenCreate} className="mt-6 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Create Your First Template</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="group relative flex flex-col justify-between border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-300 hover:shadow-lg hover:border-primary/20 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="secondary" className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full">
                      {getTemplateTypeLabel(template.type)}
                    </Badge>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(template.created_at)}</span>
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold mt-4 leading-tight group-hover:text-primary transition-colors truncate">
                    {template.name}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground/80 truncate mt-1.5">
                    Subject: {template.subject || '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-6 flex-1">
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {template.body || 'No content drafted...'}
                  </p>
                </CardContent>
                <CardFooter className="border-t border-border/40 pt-3 bg-muted/20 flex justify-end gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(template.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Duplicate">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(template)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Email Template'}</DialogTitle>
            <DialogDescription>
              Write the subject and body structure. Use personalization tags to help the AI contextualize content.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="temp-name">Template Name *</Label>
                <Input
                  id="temp-name"
                  placeholder="e.g. Cold Intro (Engineering)"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="temp-type">Template Category</Label>
                <Select value={type} onValueChange={(val) => setType((val || 'cold_outreach') as TemplateType)}>
                  <SelectTrigger id="temp-type">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="temp-subject">Default Subject Line</Label>
              <Input
                id="temp-subject"
                placeholder="e.g. Quick question regarding {{organization_name}}'s tech stack"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="temp-body">Email Body Template</Label>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>AI Personalizer Enabled</span>
                </div>
              </div>
              
              <Textarea
                id="temp-body"
                placeholder="Hi {{first_name}},\n\nI noticed you are working as {{organization_title}} at {{organization_name}}..."
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-sans resize-none text-sm"
              />

              {/* Insertion Helpers */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  <span>Click tags to insert into cursor position:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['first_name', 'last_name', 'organization_name', 'organization_title', 'organization_department'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary transition-colors border border-border/50 text-foreground"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Template'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

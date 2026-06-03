'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { type Lead, type LeadNote, type LeadStatus } from '@/types'
import { getLeadFullName, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge'
import { ArrowLeft, Trash2, Plus, Loader2, FileText, Check } from 'lucide-react'
import { toast } from 'sonner'

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'potential_customer', label: 'Potential Customer' },
  { value: 'customer', label: 'Customer' },
]

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const router = useRouter()
  const { id } = use(params)

  const [lead, setLead] = useState<Lead | null>(null)
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(true)

  // Edit fields
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgTitle, setOrgTitle] = useState('')
  const [orgDept, setOrgDept] = useState('')
  const [status, setStatus] = useState<LeadStatus>('new')

  // Note field
  const [newNoteContent, setNewNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [savingLead, setSavingLead] = useState(false)

  useEffect(() => {
    const fetchLeadData = async () => {
      try {
        const response = await fetch(`/api/leads/${id}`)
        if (!response.ok) throw new Error('Lead not found')
        const data = await response.json()

        setLead(data.lead)
        setNotes(data.notes || [])

        // Populate fields
        setFirstName(data.lead.first_name || '')
        setMiddleName(data.lead.middle_name || '')
        setLastName(data.lead.last_name || '')
        setEmail(data.lead.email || '')
        setOrgName(data.lead.organization_name || '')
        setOrgTitle(data.lead.organization_title || '')
        setOrgDept(data.lead.organization_department || '')
        setStatus(data.lead.status || 'new')
      } catch (err) {
        toast.error('Failed to load lead details.')
        router.push('/leads')
      } finally {
        setLoading(false)
      }
    }

    fetchLeadData()
  }, [id, router])

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingLead(true)

    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName || null,
          middle_name: middleName || null,
          last_name: lastName || null,
          email,
          organization_name: orgName || null,
          organization_title: orgTitle || null,
          organization_department: orgDept || null,
          status,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update lead')

      setLead(result.data)
      toast.success('Lead updated successfully.')
    } catch (err: any) {
      toast.error(err.message || 'Could not update lead.')
    } finally {
      setSavingLead(false)
    }
  }

  const handleDeleteLead = async () => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete lead')

      toast.success('Lead deleted successfully.')
      router.push('/leads')
    } catch (err) {
      toast.error('Could not delete lead.')
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteContent.trim()) return

    setAddingNote(true)
    try {
      const response = await fetch(`/api/leads/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to add note')

      setNotes((prev) => [data.data, ...prev])
      setNewNoteContent('')
      toast.success('Note added.')
    } catch (err: any) {
      toast.error(err.message || 'Could not add note.')
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/leads/${id}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete note')

      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      toast.success('Note removed.')
    } catch (err) {
      toast.error('Could not delete note.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-70px)]">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!lead) return null

  return (
    <div className="animate-fade-in-up">
      <Topbar
        title={getLeadFullName(lead)}
        subtitle="View and update lead contact details, company information, and notes."
      >
        <Button variant="outline" size="sm" onClick={() => router.push('/leads')} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Button>
      </Topbar>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details & Edit form (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
              <div>
                <CardTitle className="text-xl font-bold">Contact Profile</CardTitle>
                <CardDescription>Update profile details and status</CardDescription>
              </div>
              <LeadStatusBadge status={lead.status} />
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateLead} className="space-y-6">
                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input
                      id="middle_name"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Email and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status">Lead Status</Label>
                    <Select value={status} onValueChange={(val) => setStatus(val as LeadStatus)}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Organization Details */}
                <div className="border-t border-border/50 pt-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">Organization Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="org_name">Company Name</Label>
                      <Input
                        id="org_name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="org_title">Job Title</Label>
                      <Input
                        id="org_title"
                        value={orgTitle}
                        onChange={(e) => setOrgTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="org_dept">Department</Label>
                      <Input
                        id="org_dept"
                        value={orgDept}
                        onChange={(e) => setOrgDept(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteLead}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Lead</span>
                  </Button>

                  <Button type="submit" disabled={savingLead} className="flex items-center gap-2">
                    {savingLead ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Lead Notes panel (1 col wide) */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-xl flex flex-col h-[520px]">
            <CardHeader className="border-b border-border/50 pb-4 shrink-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Lead Notes</span>
              </CardTitle>
              <CardDescription>Activity logs and reminders</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 p-0 overflow-hidden">
              {/* Note List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                    <FileText className="w-10 h-10 stroke-1 text-muted-foreground/50 mb-2" />
                    <p className="text-xs">No notes added for this lead yet.</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="relative group p-3 bg-muted/40 hover:bg-muted/70 border border-border/50 rounded-xl transition-all duration-200">
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <p className="text-sm text-foreground whitespace-pre-wrap pr-6 leading-relaxed">
                        {note.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="p-4 border-t border-border/50 bg-background/30 space-y-3 shrink-0">
                <Textarea
                  placeholder="Write a status update or internal reminder..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="min-h-[75px] bg-background/50 text-sm resize-none focus-visible:ring-primary"
                  required
                />
                <Button type="submit" size="sm" className="w-full flex items-center gap-1.5" disabled={addingNote}>
                  {addingNote ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add Note</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

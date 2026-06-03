'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Star, Loader2, Building2, Mail, ArrowRight, Search, StickyNote, UserCheck, Trash2
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Lead } from '@/types'

export default function PotentialCustomersPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads?status=potential_customer&limit=100')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLeads(data.data || [])
    } catch {
      toast.error('Failed to load potential customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return (
      l.email.toLowerCase().includes(q) ||
      (l.first_name || '').toLowerCase().includes(q) ||
      (l.last_name || '').toLowerCase().includes(q) ||
      (l.organization_name || '').toLowerCase().includes(q)
    )
  })

  const handleConvertToCustomer = async (lead: Lead) => {
    setConverting(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'customer' }),
      })
      if (!res.ok) throw new Error('Failed to convert')
      toast.success(`${lead.first_name || lead.email} converted to Customer!`)
      fetchLeads()
    } catch {
      toast.error('Failed to convert to customer')
    } finally {
      setConverting(null)
    }
  }

  const handleRemove = async (lead: Lead) => {
    if (!confirm('Move this person back to contacted status?')) return
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'contacted' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Lead moved back to contacted')
      fetchLeads()
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const openNotes = (lead: Lead) => {
    setSelectedLead(lead)
    setNote(lead.notes || '')
    setNotesOpen(true)
  }

  const handleSaveNote = async () => {
    if (!selectedLead) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Note saved!')
      setNotesOpen(false)
      fetchLeads()
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar
        title="Potential Customers"
        subtitle="Leads showing strong buying intent — convert them to customers."
      />

      <div className="p-6 space-y-6">
        {/* Search bar */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search potential customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl border border-border p-4">
            <div className="text-2xl font-bold text-yellow-500">{leads.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Potential Customers</div>
          </div>
          <div className="glass-card rounded-xl border border-border p-4">
            <div className="text-2xl font-bold text-green-500">
              {leads.filter(l => l.organization_name).length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">With Company Info</div>
          </div>
          <div className="glass-card rounded-xl border border-border p-4">
            <div className="text-2xl font-bold text-primary">
              {leads.filter(l => l.notes).length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">With Notes</div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 glass-card rounded-2xl border border-border">
            <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Star className="w-7 h-7 text-yellow-500" />
            </div>
            <p className="text-muted-foreground text-sm">
              {search ? 'No results found' : 'No potential customers yet. Change a lead\'s status to see them here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => (
              <div
                key={lead.id}
                className="glass-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-yellow-500/30 transition-all"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-yellow-600 font-bold text-sm">
                    {(lead.first_name?.[0] || lead.email[0]).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {lead.first_name || ''} {lead.last_name || ''}
                      {!lead.first_name && !lead.last_name && lead.email}
                    </span>
                    <Badge variant="secondary" className="text-yellow-600 bg-yellow-500/10 border-yellow-500/20 text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Potential Customer
                    </Badge>
                    {lead.notes && (
                      <Badge variant="outline" className="text-xs">
                        <StickyNote className="w-3 h-3 mr-1" />Note
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />{lead.email}
                    </span>
                    {lead.organization_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{lead.organization_name}
                        {lead.organization_title && ` · ${lead.organization_title}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openNotes(lead)}
                    title="Add/view notes"
                  >
                    <StickyNote className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(lead)}
                    title="Move back to contacted"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConvertToCustomer(lead)}
                    disabled={converting === lead.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {converting === lead.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-1" />
                        Convert
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes Dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              Notes for {selectedLead?.first_name || selectedLead?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={6}
              placeholder="Add notes about this potential customer..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveNote} disabled={savingNote}>
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

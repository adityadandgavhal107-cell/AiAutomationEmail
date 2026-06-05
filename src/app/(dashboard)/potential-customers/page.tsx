'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Star, Loader2, Building2, Mail, Search, StickyNote, UserCheck, Trash2,
  Send, Sparkles, RefreshCw, MessageSquare, Clock, ArrowLeft
} from 'lucide-react'
import type { Lead, LeadMessage } from '@/types'

export default function PotentialCustomersPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Message related states
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessageBody, setNewMessageBody] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // AI related states
  const [generatingAi, setGeneratingAi] = useState(false)

  // Inbox Sync state
  const [syncing, setSyncing] = useState(false)

  // Local notes editing state
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Convert state
  const [converting, setConverting] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch potential customer leads
  const fetchLeads = useCallback(async (selectIdAfterFetch?: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads?status=potential_customer&limit=100')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const fetchedLeads = data.data || []
      setLeads(fetchedLeads)

      if (selectIdAfterFetch) {
        const found = fetchedLeads.find((l: Lead) => l.id === selectIdAfterFetch)
        if (found) setSelectedLead(found)
      }
    } catch {
      toast.error('Failed to load potential customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Fetch messages for selected lead
  const fetchMessages = useCallback(async (leadId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data.data || [])

      // Default reply subject based on last message
      const msgs = data.data || []
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1]
        const subject = lastMsg.subject || ''
        if (subject.toLowerCase().startsWith('re:')) {
          setReplySubject(subject)
        } else {
          setReplySubject(`Re: ${subject}`)
        }
      } else {
        setReplySubject('Re: Outreach Conversation')
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id)
      setNotesText(selectedLead.notes || '')
      setNewMessageBody('')
    } else {
      setMessages([])
    }
  }, [selectedLead, fetchMessages])

  // Scroll to bottom of chat bubbles
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Sync Gmail Inbox via IMAP
  const handleSyncInbox = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/email/sync', { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to sync')
      }
      const data = await res.json()
      toast.success(
        `Inbox synced! ${data.synced} new messages loaded. ${data.converted} leads promoted.`
      )

      // Refresh leads list, preserving selected lead
      const currentSelectedId = selectedLead?.id
      await fetchLeads(currentSelectedId)
    } catch (err: any) {
      toast.error(err.message || 'Error syncing inbox')
    } finally {
      setSyncing(false)
    }
  }

  // Send reply email
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !newMessageBody.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newMessageBody,
          subject: replySubject,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to send')
      }

      const data = await res.json()
      setMessages(prev => [...prev, data.data])
      setNewMessageBody('')
      toast.success('Reply email sent successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply email')
    } finally {
      setSendingMessage(false)
    }
  }

  // Generate AI suggested reply
  const handleSuggestAiReply = async () => {
    if (!selectedLead) return
    setGeneratingAi(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/ai-reply`, { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'AI generation failed')
      }
      const data = await res.json()
      setNewMessageBody(data.body || '')
      if (data.subject) {
        setReplySubject(data.subject)
      }
      toast.success('AI suggestion loaded!')
    } catch (err: any) {
      toast.error(err.message || 'AI suggestion failed')
    } finally {
      setGeneratingAi(false)
    }
  }

  // Save notes inline
  const handleSaveNotes = async () => {
    if (!selectedLead) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesText }),
      })
      if (!res.ok) throw new Error('Failed to save notes')
      toast.success('Lead notes updated!')

      // Update local state in leads list
      setLeads(prev =>
        prev.map(l => (l.id === selectedLead.id ? { ...l, notes: notesText } : l))
      )
      setSelectedLead(prev => (prev ? { ...prev, notes: notesText } : null))
    } catch {
      toast.error('Failed to update notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Convert to paying customer
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
      setSelectedLead(null)
      fetchLeads()
    } catch {
      toast.error('Failed to convert to customer')
    } finally {
      setConverting(null)
    }
  }

  // Remove potential customer status (demote to contacted)
  const handleRemove = async (lead: Lead) => {
    if (!confirm('Move this person back to contacted status?')) return
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'contacted' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Lead status updated back to contacted')
      setSelectedLead(null)
      fetchLeads()
    } catch {
      toast.error('Failed to update lead status')
    }
  }

  // Filter list by search query
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return (
      l.email.toLowerCase().includes(q) ||
      (l.first_name || '').toLowerCase().includes(q) ||
      (l.last_name || '').toLowerCase().includes(q) ||
      (l.organization_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="animate-fade-in-up flex flex-col h-[calc(100vh-64px)]">
      <Topbar
        title="Conversations & Potential Customers"
        subtitle="Track replies, communicate directly with high-intent leads, and draft PROSMART EMAIL CRM responses."
      >
        <Button
          onClick={handleSyncInbox}
          disabled={syncing}
          variant="outline"
          className="flex items-center gap-2"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
          ) : (
            <RefreshCw className="w-4 h-4 text-yellow-500" />
          )}
          {syncing ? 'Syncing Gmail Inbox...' : 'Sync Gmail Inbox'}
        </Button>
      </Topbar>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Potential Customers List */}
        <div className="w-[380px] flex flex-col border border-border glass-card rounded-2xl overflow-hidden bg-card/40">
          <div className="p-4 border-b border-border space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search potential customers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{filtered.length} Potential Customers</span>
              <span className="font-semibold text-yellow-500">Showing strong intent</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading && leads.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                {search ? 'No results found' : 'No potential customers yet. Sync your inbox to look for replies, or manually promote leads.'}
              </div>
            ) : (
              filtered.map(lead => {
                const isSelected = selectedLead?.id === lead.id
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left p-4 transition-all flex items-start gap-3 hover:bg-muted/30 ${isSelected ? 'bg-primary/10 border-l-4 border-yellow-500' : 'border-l-4 border-transparent'
                      }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0 text-yellow-600 font-bold text-sm">
                      {(lead.first_name?.[0] || lead.email[0]).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-medium text-sm truncate">
                          {lead.first_name || lead.last_name
                            ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                            : lead.email}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20 px-1 py-0 h-4">
                          Reply Sync
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.email}</p>
                      {lead.organization_name && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 mt-1">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{lead.organization_name}</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Conversational Hub & Details */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {selectedLead ? (
            <>
              {/* Chat panel */}
              <div className="flex-1 flex flex-col border border-border glass-card rounded-2xl overflow-hidden bg-card/20">
                {/* Chat Header */}
                <div className="p-4 border-b border-border bg-card/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 font-bold text-base">
                      {(selectedLead.first_name?.[0] || selectedLead.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {selectedLead.first_name || selectedLead.last_name
                          ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim()
                          : selectedLead.email}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span>{selectedLead.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemove(selectedLead)}
                      title="Demote back to contacted status"
                      className="h-8 border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Demote
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleConvertToCustomer(selectedLead)}
                      disabled={converting === selectedLead.id}
                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                    >
                      {converting === selectedLead.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Convert to Customer
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Chat Bubbles */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Loading chat history...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-primary/40" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Start the conversation</p>
                        <p className="text-xs max-w-xs mt-1">
                          No replies saved in the database yet. You can sync the inbox or type a custom followup email below to send.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isLead = msg.sender === 'lead'
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isLead ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl p-4 shadow-sm space-y-1 ${isLead
                                ? 'bg-muted/40 border border-border/80 text-foreground rounded-tl-none'
                                : 'bg-primary text-primary-foreground rounded-tr-none'
                              }`}
                          >
                            {msg.subject && (
                              <div className={`text-[10px] uppercase font-bold tracking-wider opacity-60`}>
                                Subject: {msg.subject}
                              </div>
                            )}
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.body}
                            </div>
                            <div
                              className={`text-[9px] flex items-center gap-1 mt-2 opacity-50 ${isLead ? 'text-muted-foreground justify-start' : 'text-primary-foreground justify-end'
                                }`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(msg.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Composer */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-card/30 space-y-3">
                  <div className="flex gap-2 items-center">
                    <Label htmlFor="subject" className="text-xs text-muted-foreground font-medium w-16">Subject:</Label>
                    <Input
                      id="subject"
                      value={replySubject}
                      onChange={e => setReplySubject(e.target.value)}
                      placeholder="Email subject..."
                      className="h-8 text-xs flex-1"
                    />
                  </div>

                  <div className="relative">
                    <Textarea
                      value={newMessageBody}
                      onChange={e => setNewMessageBody(e.target.value)}
                      placeholder={`Draft a response to ${selectedLead.first_name || selectedLead.email}...`}
                      rows={4}
                      className="pr-10 resize-none text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSuggestAiReply}
                      disabled={generatingAi}
                      className="text-xs border-border flex items-center gap-1.5 h-9"
                    >
                      {generatingAi ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                      {generatingAi ? 'Generating Suggestions...' : 'Suggest AI Reply'}
                    </Button>

                    <Button
                      type="submit"
                      disabled={sendingMessage || !newMessageBody.trim()}
                      className="bg-primary text-primary-foreground text-xs flex items-center gap-1.5 h-9"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      {sendingMessage ? 'Sending Email...' : 'Send Email Reply'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Sidebar Info/Notes */}
              <div className="w-[300px] border border-border glass-card rounded-2xl bg-card/40 p-4 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Lead Info</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Name</span>
                        <span className="text-sm font-semibold text-foreground">
                          {selectedLead.first_name || selectedLead.last_name
                            ? `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim()
                            : 'Not specified'}
                        </span>
                      </div>

                      {selectedLead.organization_name && (
                        <div>
                          <span className="text-[11px] text-muted-foreground block font-normal">Organization</span>
                          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            {selectedLead.organization_name}
                          </span>
                        </div>
                      )}

                      {selectedLead.organization_title && (
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Job Title</span>
                          <span className="text-xs font-medium text-foreground">
                            {selectedLead.organization_title}
                            {selectedLead.organization_department && ` (${selectedLead.organization_department})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <hr className="border-border/60" />

                  <div className="flex-1 flex flex-col">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                      <StickyNote className="w-3.5 h-3.5" />
                      Conversation Notes
                    </h4>
                    <Textarea
                      value={notesText}
                      onChange={e => setNotesText(e.target.value)}
                      placeholder="Add conversation notes, next steps, meeting times..."
                      rows={8}
                      className="text-xs resize-none bg-card/20 focus-visible:ring-1"
                    />
                    <Button
                      onClick={handleSaveNotes}
                      disabled={savingNotes || notesText === (selectedLead.notes || '')}
                      size="sm"
                      className="mt-2 text-xs w-full bg-muted border border-border text-foreground hover:bg-muted/80 h-8"
                    >
                      {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Save Notes
                    </Button>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground text-center mt-6">
                  Last updated {new Date(selectedLead.updated_at).toLocaleDateString()}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 border border-border glass-card rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-card/10">
              <div className="w-16 h-16 rounded-full bg-yellow-500/5 flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-yellow-500/60 animate-pulse" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Conversational AI Inbox</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1.5">
                Select a potential customer from the left sidebar to view their email thread, draft AI suggested replies, and track communication.
              </p>
              <Button
                variant="outline"
                onClick={handleSyncInbox}
                disabled={syncing}
                className="mt-6 flex items-center gap-2 border-border"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-yellow-500" />
                )}
                Sync Inbox Now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  UserCheck, Loader2, Building2, Mail, Search, Star, ArrowLeft
} from 'lucide-react'
import type { Lead } from '@/types'

export default function CustomersPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [demoting, setDemoting] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads?status=customer&limit=500')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLeads(data.data || [])
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleDemote = async (lead: Lead) => {
    if (!confirm(`Move ${lead.first_name || lead.email} back to Potential Customer?`)) return
    setDemoting(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'potential_customer' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Moved back to Potential Customers')
      fetchLeads()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setDemoting(null)
    }
  }

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
    <div className="animate-fade-in-up">
      <Topbar title="Confirmed Customers" subtitle="Leads who have been converted to paying customers." />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{leads.length}</p>
              <p className="text-xs text-muted-foreground">Total Customers</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center glass-card rounded-2xl border border-border">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-green-500/60" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No customers yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Convert leads from the Potential Customers section when they become paying customers.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(lead => (
              <div
                key={lead.id}
                className="glass-card rounded-xl border border-green-500/20 bg-green-500/5 p-5 flex flex-col gap-3 hover:border-green-500/40 transition-all"
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 font-bold text-base flex-shrink-0">
                    {(lead.first_name?.[0] || lead.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                        : lead.email}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                {(lead.organization_name || lead.organization_title) && (
                  <div className="space-y-1">
                    {lead.organization_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{lead.organization_name}</span>
                      </div>
                    )}
                    {lead.organization_title && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-block">
                        {lead.organization_title}
                        {lead.organization_department && ` · ${lead.organization_department}`}
                      </span>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between pt-1 border-t border-green-500/10">
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30 bg-green-500/5">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Customer
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                    onClick={() => handleDemote(lead)}
                    disabled={demoting === lead.id}
                    title="Move back to Potential Customers"
                  >
                    {demoting === lead.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><ArrowLeft className="w-3 h-3 mr-1" />Revert</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

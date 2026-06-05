'use client'

import { useState } from 'react'
import { type Lead, type LeadStatus } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LeadStatusBadge } from './LeadStatusBadge'
import { getLeadFullName, truncate } from '@/lib/utils'
import { Eye, Trash2, MoreHorizontal, ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { toast } from 'sonner'

interface LeadTableProps {
  leads: Lead[]
  loading: boolean
  totalCount: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onStatusChange: (leadId: string, status: LeadStatus) => void
  onDelete: (leadId: string) => void
  onBulkDelete?: (ids: string[]) => void
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new',                label: '🔵 New',                 color: '' },
  { value: 'contacted',          label: '📨 Contacted',           color: '' },
  { value: 'follow_up',          label: '🔄 Follow Up',           color: '' },
  { value: 'potential_customer', label: '⭐ Potential Customer',   color: 'text-amber-500' },
  { value: 'customer',           label: '✅ Confirmed Customer',   color: 'text-green-600' },
]

export function LeadTable({
  leads,
  loading,
  totalCount,
  page,
  limit,
  onPageChange,
  onStatusChange,
  onDelete,
  onBulkDelete,
}: LeadTableProps) {
  const totalPages = Math.ceil(totalCount / limit)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        leads.forEach(l => next.delete(l.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        leads.forEach(l => next.add(l.id))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleStatusUpdate = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      onStatusChange(leadId, newStatus)
      toast.success('Lead status updated successfully.')
    } catch (err) {
      toast.error('Could not update lead status.')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected lead${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      if (onBulkDelete) {
        await onBulkDelete(ids)
      } else {
        await Promise.all(ids.map(id =>
          fetch(`/api/leads/${id}`, { method: 'DELETE' })
        ))
        toast.success(`Deleted ${ids.length} lead${ids.length > 1 ? 's' : ''}.`)
      }
      setSelectedIds(new Set())
    } catch {
      toast.error('Some leads could not be deleted.')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Checkbox column */}
              <TableHead className="w-[44px] pr-0">
                <div
                  onClick={toggleAll}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all mx-auto ${
                    allSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                  }`}
                  title={allSelected ? 'Deselect all' : 'Select all on this page'}
                >
                  {allSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Organization</TableHead>
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[80px] text-right font-semibold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  No leads found. Import a CSV or add a lead to get started.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const isChecked = selectedIds.has(lead.id)
                return (
                  <TableRow
                    key={lead.id}
                    className={`group hover:bg-muted/10 transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                  >
                    {/* Checkbox */}
                    <TableCell className="pr-0">
                      <div
                        onClick={() => toggleOne(lead.id)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all mx-auto ${
                          isChecked ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/40'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/leads/${lead.id}`} className="hover:text-primary transition-colors">
                        {getLeadFullName(lead)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{lead.email}</TableCell>
                    <TableCell>{lead.organization_name || '—'}</TableCell>
                    <TableCell>
                      {lead.organization_title ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/30">
                          {lead.organization_title}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none">
                          <div className="cursor-pointer hover:opacity-80 transition-opacity">
                            <LeadStatusBadge status={lead.status} />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold uppercase tracking-wider">Change Status</p>
                          {STATUS_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => handleStatusUpdate(lead.id, opt.value)}
                              className={`text-xs cursor-pointer ${lead.status === opt.value ? 'bg-primary/10 font-semibold' : ''} ${opt.color}`}
                            >
                              {opt.label}
                              {lead.status === opt.value && <span className="ml-auto text-primary">✓</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={
                            <Link href={`/leads/${lead.id}`} className="flex items-center gap-2 text-xs" />
                          }>
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(lead.id)}
                            className="flex items-center gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Lead</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{leads.length}</span> of{' '}
            <span className="font-semibold text-foreground">{totalCount}</span> leads
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar — floats at the bottom when leads are selected */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl shadow-2xl px-5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span className="font-semibold">{selectedIds.size}</span>
              <span className="text-muted-foreground">lead{selectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-8 flex items-center gap-1.5"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5" />Delete Selected</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

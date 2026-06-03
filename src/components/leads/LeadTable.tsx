'use client'

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
import { Eye, Trash2, Edit2, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
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
}

const STATUS_VALUES: LeadStatus[] = ['new', 'contacted', 'follow_up', 'potential_customer', 'customer']

export function LeadTable({
  leads,
  loading,
  totalCount,
  page,
  limit,
  onPageChange,
  onStatusChange,
  onDelete,
}: LeadTableProps) {
  const totalPages = Math.ceil(totalCount / limit)

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No leads found. Import a CSV or add a lead to get started.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="group hover:bg-muted/10 transition-colors">
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
                      <DropdownMenuContent align="start">
                        {STATUS_VALUES.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusUpdate(lead.id, status)}
                            className="text-xs"
                          >
                            <LeadStatusBadge status={status} className="border-0 bg-transparent px-0 py-0" />
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
              ))
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
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { LeadTable } from '@/components/leads/LeadTable'
import { LeadFilters } from '@/components/leads/LeadFilters'
import { CsvUploader } from '@/components/leads/CsvUploader'
import { type Lead, type LeadStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Plus, UserPlus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(15)

  // Filters State
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  // Dialog State
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New Lead Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgTitle, setOrgTitle] = useState('')
  const [orgDept, setOrgDept] = useState('')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status: status === 'all' ? '' : status,
      })

      const response = await fetch(`/api/leads?${query}`)
      if (!response.ok) throw new Error('Failed to fetch leads')

      const result = await response.json()
      setLeads(result.data || [])
      setTotalCount(result.count || 0)
    } catch (err) {
      toast.error('Failed to load leads. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, status])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Debounced search reset
  useEffect(() => {
    setPage(1)
  }, [search, status])

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    )
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete lead')

      toast.success('Lead deleted successfully.')
      fetchLeads()
    } catch (err) {
      toast.error('Could not delete lead.')
    }
  }

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          email,
          organization_name: orgName || null,
          organization_title: orgTitle || null,
          organization_department: orgDept || null,
          status: 'new',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add lead.')
      }

      toast.success('Lead added successfully!')
      setOpen(false)
      // Reset form
      setFirstName('')
      setLastName('')
      setEmail('')
      setOrgName('')
      setOrgTitle('')
      setOrgDept('')
      fetchLeads()
    } catch (err: any) {
      toast.error(err.message || 'Could not add lead.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatus('all')
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Leads" subtitle="Manage and categorize your target outreach audience.">
        <div className="flex items-center gap-2">
          {/* CSV Uploader */}
          <CsvUploader onImportComplete={fetchLeads} />

          {/* Add Lead Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="flex items-center gap-2" />}>
              <UserPlus className="w-4 h-4" />
              <span>Add Lead</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Add Single Lead</DialogTitle>
                <DialogDescription>
                  Enter the details of the lead you want to add manually.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddLeadSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">Email Address *</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="jane.doe@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org_name">Company / Organization</Label>
                  <Input
                    id="org_name"
                    placeholder="Acme Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="org_title">Job Title</Label>
                    <Input
                      id="org_title"
                      placeholder="VP of Sales"
                      value={orgTitle}
                      onChange={(e) => setOrgTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org_dept">Department</Label>
                    <Input
                      id="org_dept"
                      placeholder="Sales"
                      value={orgDept}
                      onChange={(e) => setOrgDept(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Save Lead'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Topbar>

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="glass-card p-4 rounded-xl border border-border">
          <LeadFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            onClear={handleClearFilters}
          />
        </div>

        {/* Lead Table */}
        <LeadTable
          leads={leads}
          loading={loading}
          totalCount={totalCount}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteLead}
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Loader2, TrendingUp, Users, Send, Star, UserCheck, Inbox, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Campaign {
  id: string
  name: string
  status: string
  emails_sent: number
  created_at: string
}

interface Lead {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: 'new' | 'contacted' | 'follow_up' | 'potential_customer' | 'customer'
  organization_name: string | null
  created_at: string
}

interface Recipient {
  lead_id: string
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
}

const STATUS_COLORS = {
  new: '#6366f1',
  contacted: '#3b82f6',
  follow_up: '#f59e0b',
  potential_customer: '#eab308',
  customer: '#22c55e',
}

const DELIVERY_COLORS = {
  sent: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  // Campaign specific state
  const [selectedCampaignId, setSelectedCampaignId] = useState('all')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  useEffect(() => {
    async function fetchBaseData() {
      try {
        const [leadsRes, campaignsRes] = await Promise.all([
          fetch('/api/leads?limit=1000'),
          fetch('/api/campaigns?limit=100'),
        ])

        const leadsData = await leadsRes.json()
        const campaignsData = await campaignsRes.json()

        setLeads(leadsData.data || [])
        setCampaigns(campaignsData.data || [])
      } catch (err) {
        console.error('Failed to fetch analytics base data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBaseData()
  }, [])

  useEffect(() => {
    if (selectedCampaignId === 'all') {
      setRecipients([])
      return
    }

    async function fetchRecipients() {
      setLoadingRecipients(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('campaign_recipients')
          .select('lead_id, status, sent_at')
          .eq('campaign_id', selectedCampaignId)

        if (error) throw error
        setRecipients(data || [])
      } catch (err) {
        console.error('Failed to fetch campaign recipients', err)
      } finally {
        setLoadingRecipients(false)
      }
    }
    fetchRecipients()
  }, [selectedCampaignId])

  // Derived calculations
  const isCampaignSelected = selectedCampaignId !== 'all'
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId)

  // Filtered Leads
  const targetLeads = isCampaignSelected
    ? leads.filter(l => recipients.some(r => r.lead_id === l.id))
    : leads

  // KPIs
  const totalLeadsVal = targetLeads.length
  const potentialCustomersVal = targetLeads.filter(l => l.status === 'potential_customer').length
  const customersVal = targetLeads.filter(l => l.status === 'customer').length

  let sentEmailsVal = 0
  let pendingEmailsVal = 0
  let failedEmailsVal = 0

  if (isCampaignSelected) {
    sentEmailsVal = recipients.filter(r => r.status === 'sent').length
    pendingEmailsVal = recipients.filter(r => r.status === 'pending').length
    failedEmailsVal = recipients.filter(r => r.status === 'failed').length
  } else {
    sentEmailsVal = campaigns.reduce((acc, c) => acc + (c.emails_sent || 0), 0)
  }

  const kpis = isCampaignSelected
    ? [
        { label: 'Leads Targeted', value: totalLeadsVal, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Emails Sent', value: sentEmailsVal, icon: Send, color: 'text-green-500', bg: 'bg-green-500/10' },
        { label: 'Pending in Queue', value: pendingEmailsVal, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Failed Sends', value: failedEmailsVal, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        { label: 'Converted Customers', value: customersVal, icon: UserCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      ]
    : [
        { label: 'Total Leads', value: totalLeadsVal, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Campaigns Run', value: campaigns.length, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Total Emails Sent', value: sentEmailsVal, icon: Send, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
        { label: 'Potential Customers', value: potentialCustomersVal, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { label: 'Converted Customers', value: customersVal, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
      ]

  // Status Distribution
  const statusCount: Record<string, number> = {}
  targetLeads.forEach(l => {
    statusCount[l.status] = (statusCount[l.status] || 0) + 1
  })

  const leadsByStatus = Object.entries(statusCount).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
    color: STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#6366f1',
  }))

  // Delivery Distribution
  const deliveryData = isCampaignSelected
    ? [
        { name: 'Sent', value: sentEmailsVal, color: DELIVERY_COLORS.sent },
        { name: 'Pending', value: pendingEmailsVal, color: DELIVERY_COLORS.pending },
        { name: 'Failed', value: failedEmailsVal, color: DELIVERY_COLORS.failed },
      ].filter(d => d.value > 0)
    : []

  // Lead Growth (Last 7 Days)
  const now = new Date()
  const leadGrowth = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' })
    const count = targetLeads.filter(l => {
      const created = new Date(l.created_at)
      return created <= d && created >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    }).length
    return { date: dateStr, leads: count }
  })

  // Conversion Funnel
  const funnelSteps = funnelStepsCalc()
  function funnelStepsCalc() {
    return [
      { label: 'Targeted Leads', value: totalLeadsVal, pct: 100, color: 'bg-blue-500' },
      { label: 'Contacted', value: targetLeads.filter(l => l.status !== 'new').length, pct: totalLeadsVal > 0 ? Math.round((targetLeads.filter(l => l.status !== 'new').length / totalLeadsVal) * 100) : 0, color: 'bg-indigo-500' },
      { label: 'Potential Customers', value: potentialCustomersVal, pct: totalLeadsVal > 0 ? Math.round((potentialCustomersVal / totalLeadsVal) * 100) : 0, color: 'bg-yellow-500' },
      { label: 'Converted Customers', value: customersVal, pct: totalLeadsVal > 0 ? Math.round((customersVal / totalLeadsVal) * 100) : 0, color: 'bg-green-500' },
    ]
  }

  // Global Campaign Activity
  const campaignActivity = campaigns.slice(0, 8).map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '…' : c.name,
    sent: c.emails_sent || 0,
    campaigns: 1,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color || p.stroke }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Analytics" subtitle="Track your outreach performance and lead conversion metrics.">
        {/* Campaign Filter Dropdown */}
        <div className="flex items-center gap-3 bg-card border border-border px-3.5 py-1.5 rounded-xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign Filter:</span>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="all">All Campaigns (Global Stats)</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </Topbar>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {kpis.map(kpi => {
                const Icon = kpi.icon
                return (
                  <div key={kpi.label} className="glass-card rounded-xl border border-border p-4 space-y-3">
                    <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Line or Bar Chart */}
              <div className="lg:col-span-2 glass-card rounded-xl border border-border p-5">
                {isCampaignSelected ? (
                  <>
                    <h3 className="font-semibold mb-1">Email Delivery Status</h3>
                    <p className="text-xs text-muted-foreground mb-4">Outbox stats for &quot;{selectedCampaign?.name}&quot;</p>
                    {loadingRecipients ? (
                      <div className="flex items-center justify-center h-[220px]">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : deliveryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={deliveryData} barSize={60} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" name="Count">
                            {deliveryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                        No delivery data available for this campaign yet.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold mb-1">Lead Pipeline (Last 7 Days)</h3>
                    <p className="text-xs text-muted-foreground mb-4">Cumulative leads in your system</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={leadGrowth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="leads"
                          name="Leads"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>

              {/* Lead Status Donut */}
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Lead Stage Distribution</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {isCampaignSelected ? 'Target leads stage breakdown' : 'Global system breakdown'}
                </p>
                {leadsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={leadsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {leadsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => <span className="text-[11px] font-medium text-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                    No lead data yet
                  </div>
                )}
              </div>
            </div>

            {/* Campaign Emails Sent Bar Chart (Only in Global view) */}
            {!isCampaignSelected && campaignActivity.length > 0 && (
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Emails Sent per Campaign</h3>
                <p className="text-xs text-muted-foreground mb-4">Most recent campaigns activity</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={campaignActivity} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sent" name="Emails Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Conversion Summary Funnel */}
            {totalLeadsVal > 0 && (
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-4">Campaign Conversion Funnel</h3>
                <div className="space-y-3">
                  {funnelSteps.map(item => (
                    <div key={item.label} className="flex items-center gap-4">
                      <div className="w-40 text-sm text-muted-foreground flex-shrink-0">{item.label}</div>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                      <div className="w-20 text-sm text-right flex-shrink-0">
                        <span className="font-medium">{item.value}</span>
                        <span className="text-muted-foreground ml-1">({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Recipients Detail */}
            {isCampaignSelected && (
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Targeted Leads Details</h3>
                <p className="text-xs text-muted-foreground mb-4">Delivery and stage tracking for leads targeted by this campaign</p>
                {loadingRecipients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No recipients registered for this campaign.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-medium text-xs">
                          <th className="py-2.5">Name</th>
                          <th className="py-2.5">Email</th>
                          <th className="py-2.5">Company</th>
                          <th className="py-2.5">Lead Stage</th>
                          <th className="py-2.5">Delivery Status</th>
                          <th className="py-2.5 text-right">Sent Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {recipients.map(r => {
                          const lead = leads.find(l => l.id === r.lead_id)
                          if (!lead) return null
                          return (
                            <tr key={r.lead_id} className="hover:bg-muted/10">
                              <td className="py-2.5 font-medium">
                                {lead.first_name || lead.last_name
                                  ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                  : '—'}
                              </td>
                              <td className="py-2.5 font-mono text-xs text-muted-foreground">{lead.email}</td>
                              <td className="py-2.5">{lead.organization_name || '—'}</td>
                              <td className="py-2.5 capitalize">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  lead.status === 'customer' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                  lead.status === 'potential_customer' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  'bg-muted text-muted-foreground border border-border/30'
                                }`}>
                                  {lead.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-2.5 capitalize">
                                <span className={`text-xs font-semibold ${
                                  r.status === 'sent' ? 'text-green-500' :
                                  r.status === 'pending' ? 'text-amber-500' :
                                  'text-red-500'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-xs text-muted-foreground">
                                {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

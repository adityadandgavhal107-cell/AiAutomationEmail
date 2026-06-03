'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Loader2, TrendingUp, Users, Send, Star, UserCheck } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Stats {
  totalLeads: number
  totalCampaigns: number
  emailsSent: number
  potentialCustomers: number
  customers: number
  leadsByStatus: { name: string; value: number; color: string }[]
  campaignActivity: { name: string; sent: number; campaigns: number }[]
  leadGrowth: { date: string; leads: number }[]
}

const STATUS_COLORS = {
  new: '#6366f1',
  contacted: '#3b82f6',
  follow_up: '#f59e0b',
  potential_customer: '#eab308',
  customer: '#22c55e',
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [leadsRes, campaignsRes] = await Promise.all([
          fetch('/api/leads?limit=1000'),
          fetch('/api/campaigns?limit=100'),
        ])

        const leadsData = await leadsRes.json()
        const campaignsData = await campaignsRes.json()

        const leads: any[] = leadsData.data || []
        const campaigns: any[] = campaignsData.data || []

        // Lead status breakdown
        const statusCount: Record<string, number> = {}
        leads.forEach((l: any) => {
          statusCount[l.status] = (statusCount[l.status] || 0) + 1
        })

        const leadsByStatus = Object.entries(statusCount).map(([name, value]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value,
          color: STATUS_COLORS[name as keyof typeof STATUS_COLORS] || '#6366f1',
        }))

        // Lead growth (last 7 days)
        const now = new Date()
        const leadGrowth = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now)
          d.setDate(d.getDate() - (6 - i))
          const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' })
          const count = leads.filter((l: any) => {
            const created = new Date(l.created_at)
            return created <= d && created >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
          }).length
          return { date: dateStr, leads: count }
        })

        // Campaign activity
        const campaignActivity = campaigns.slice(0, 8).map((c: any) => ({
          name: c.name.length > 15 ? c.name.substring(0, 15) + '…' : c.name,
          sent: c.emails_sent || 0,
          campaigns: 1,
        }))

        const emailsSent = campaigns.reduce((acc: number, c: any) => acc + (c.emails_sent || 0), 0)

        setStats({
          totalLeads: leads.length,
          totalCampaigns: campaigns.length,
          emailsSent,
          potentialCustomers: leads.filter((l: any) => l.status === 'potential_customer').length,
          customers: leads.filter((l: any) => l.status === 'customer').length,
          leadsByStatus,
          campaignActivity,
          leadGrowth,
        })
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const kpis = stats
    ? [
        { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Campaigns Run', value: stats.totalCampaigns, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Emails Sent', value: stats.emailsSent, icon: Send, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
        { label: 'Potential Customers', value: stats.potentialCustomers, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        { label: 'Converted Customers', value: stats.customers, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
      ]
    : []

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }}>
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
      <Topbar title="Analytics" subtitle="Track your outreach performance and lead conversion metrics." />

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

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lead Growth Line Chart */}
              <div className="lg:col-span-2 glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Lead Pipeline (Last 7 Days)</h3>
                <p className="text-xs text-muted-foreground mb-4">Cumulative leads in your system</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats?.leadGrowth || []}>
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
              </div>

              {/* Lead Status Donut */}
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Lead Status Distribution</h3>
                <p className="text-xs text-muted-foreground mb-4">Breakdown by current status</p>
                {stats?.leadsByStatus && stats.leadsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={stats.leadsByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {stats.leadsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
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

            {/* Campaign Emails Sent Bar Chart */}
            {stats?.campaignActivity && stats.campaignActivity.length > 0 && (
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-1">Emails Sent per Campaign</h3>
                <p className="text-xs text-muted-foreground mb-4">Most recent campaigns</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.campaignActivity} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sent" name="Emails Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Conversion Summary */}
            {stats && stats.totalLeads > 0 && (
              <div className="glass-card rounded-xl border border-border p-5">
                <h3 className="font-semibold mb-4">Conversion Funnel</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Total Leads', value: stats.totalLeads, pct: 100, color: 'bg-blue-500' },
                    { label: 'Contacted', value: (stats.leadsByStatus.find(s => s.name === 'Contacted')?.value || 0), pct: stats.totalLeads > 0 ? Math.round(((stats.leadsByStatus.find(s => s.name === 'Contacted')?.value || 0) / stats.totalLeads) * 100) : 0, color: 'bg-indigo-500' },
                    { label: 'Potential Customers', value: stats.potentialCustomers, pct: stats.totalLeads > 0 ? Math.round((stats.potentialCustomers / stats.totalLeads) * 100) : 0, color: 'bg-yellow-500' },
                    { label: 'Converted Customers', value: stats.customers, pct: stats.totalLeads > 0 ? Math.round((stats.customers / stats.totalLeads) * 100) : 0, color: 'bg-green-500' },
                  ].map(item => (
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
          </>
        )}
      </div>
    </div>
  )
}

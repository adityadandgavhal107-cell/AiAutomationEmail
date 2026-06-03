import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { StatsCard } from '@/components/analytics/StatsCard'
import { Users, Megaphone, Mail, Star, TrendingUp } from 'lucide-react'
import { RecentCampaigns } from '@/components/analytics/RecentCampaigns'
import { LeadStatusChart } from '@/components/analytics/LeadStatusChart'

export const metadata = { title: 'Dashboard' }

async function getStats(userId: string) {
  const supabase = await createClient()
  const [
    { count: totalLeads },
    { count: totalCampaigns },
    { count: potentialCustomers },
    { count: customers },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'potential_customer'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'customer'),
    supabase.from('campaigns').select('id, name, status, emails_sent, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
  ])

  const emailsSent = campaigns?.reduce((acc: number, c: { emails_sent?: number | null }) => acc + (c.emails_sent || 0), 0) ?? 0

  return {
    totalLeads: totalLeads ?? 0,
    totalCampaigns: totalCampaigns ?? 0,
    emailsSent,
    potentialCustomers: potentialCustomers ?? 0,
    customers: customers ?? 0,
    recentCampaigns: campaigns ?? [],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getStats(user.id)

  return (
    <div className="animate-fade-in-up">
      <Topbar
        title="Dashboard"
        subtitle={`Welcome back! Here's your outreach overview.`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Total Leads"
            value={stats.totalLeads}
            icon={Users}
            color="blue"
            href="/leads"
          />
          <StatsCard
            title="Campaigns"
            value={stats.totalCampaigns}
            icon={Megaphone}
            color="purple"
            href="/campaigns"
          />
          <StatsCard
            title="Emails Sent"
            value={stats.emailsSent}
            icon={Mail}
            color="cyan"
          />
          <StatsCard
            title="Potential Customers"
            value={stats.potentialCustomers}
            icon={Star}
            color="yellow"
            href="/potential-customers"
          />
          <StatsCard
            title="Customers"
            value={stats.customers}
            icon={TrendingUp}
            color="green"
          />
        </div>

        {/* Charts + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentCampaigns campaigns={stats.recentCampaigns} />
          </div>
          <div>
            <LeadStatusChart userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

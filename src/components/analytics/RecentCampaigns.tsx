'use client'

import { formatDate } from '@/lib/utils'
import { getCampaignStatusColor } from '@/lib/utils'
import { Megaphone } from 'lucide-react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  status: string
  emails_sent: number
  created_at: string
}

export function RecentCampaigns({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Recent Campaigns</h3>
        <Link href="/campaigns" className="text-xs text-primary hover:underline">View all</Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Megaphone className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No campaigns yet</p>
          <Link href="/campaigns/new" className="mt-2 text-xs text-primary hover:underline">Create your first campaign</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{c.emails_sent} sent</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getCampaignStatusColor(c.status as any)}`}>
                  {c.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

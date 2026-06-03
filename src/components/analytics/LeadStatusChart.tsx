'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getLeadStatusLabel } from '@/lib/utils'

const COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#eab308',
  follow_up: '#f97316',
  potential_customer: '#a855f7',
  customer: '#10b981',
}

interface LeadStatusChartProps {
  userId: string
}

export function LeadStatusChart({ userId }: LeadStatusChartProps) {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: leads } = await supabase
        .from('leads')
        .select('status')
        .eq('user_id', userId)

      if (!leads) return

      const counts: Record<string, number> = {}
      leads.forEach((l: { status: string }) => {
        counts[l.status] = (counts[l.status] || 0) + 1
      })

      const chartData = Object.entries(counts).map(([status, count]) => ({
        name: getLeadStatusLabel(status as any),
        value: count,
        color: COLORS[status] || '#6b7280',
      }))

      setData(chartData)
      setLoading(false)
    }
    fetchData()
  }, [userId])

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <h3 className="font-semibold text-foreground mb-4">Lead Status Breakdown</h3>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No lead data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

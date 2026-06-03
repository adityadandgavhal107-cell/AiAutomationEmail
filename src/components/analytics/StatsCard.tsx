import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  color: 'blue' | 'purple' | 'cyan' | 'yellow' | 'green'
  href?: string
}

const colorMap = {
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   icon: 'bg-blue-500/20 text-blue-400' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500/20 text-purple-400' },
  cyan:   { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   icon: 'bg-cyan-500/20 text-cyan-400' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'bg-yellow-500/20 text-yellow-400' },
  green:  { bg: 'bg-emerald-500/10',text: 'text-emerald-400',icon: 'bg-emerald-500/20 text-emerald-400' },
}

export function StatsCard({ title, value, icon: Icon, color, href }: StatsCardProps) {
  const colors = colorMap[color]

  const content = (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-border p-5 transition-all duration-200',
      'bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
      href && 'cursor-pointer hover:-translate-y-0.5'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={cn('text-3xl font-bold mt-2', colors.text)}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className={cn('p-2.5 rounded-lg', colors.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {/* Decorative glow blob */}
      <div className={cn('absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-xl', colors.bg)} />
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

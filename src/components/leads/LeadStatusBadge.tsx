import { type LeadStatus } from '@/types'
import { getLeadStatusColor, getLeadStatusLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface LeadStatusBadgeProps {
  status: LeadStatus
  className?: string
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const colorClass = getLeadStatusColor(status)
  const label = getLeadStatusLabel(status)

  return (
    <Badge variant="outline" className={`${colorClass} px-2.5 py-0.5 font-semibold text-xs border rounded-full ${className}`}>
      {label}
    </Badge>
  )
}

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { type LeadStatus, type TemplateType, type CampaignStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getLeadStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow-Up',
    potential_customer: 'Potential Customer',
    customer: 'Customer',
  }
  return labels[status] || status
}

export function getLeadStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    contacted: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    follow_up: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    potential_customer: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    customer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  }
  return colors[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
}

export function getTemplateTypeLabel(type: TemplateType): string {
  const labels: Record<TemplateType, string> = {
    cold_outreach: 'Cold Outreach',
    follow_up_1: 'Follow-Up 1',
    follow_up_2: 'Follow-Up 2',
    partnership_proposal: 'Partnership Proposal',
    product_demo: 'Product Demo',
    custom: 'Custom',
  }
  return labels[type] || type
}

export function getCampaignStatusColor(status: CampaignStatus): string {
  const colors: Record<CampaignStatus, string> = {
    draft: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    sending: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    sent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return colors[status] || 'bg-gray-500/15 text-gray-400'
}

export function getLeadFullName(lead: {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
}): string {
  return [lead.first_name, lead.middle_name, lead.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown'
}

export function truncate(str: string | null | undefined, length = 60): string {
  if (!str) return '—'
  return str.length > length ? str.slice(0, length) + '…' : str
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's')
}

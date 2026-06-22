export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'potential_customer' | 'customer'
export type TemplateType = 'cold_outreach' | 'follow_up_1' | 'follow_up_2' | 'partnership_proposal' | 'product_demo' | 'custom'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed'
export type AudienceType = 'all' | 'selected' | 'potential_customers'
export type AiTone = 'professional' | 'friendly' | 'formal' | 'startup' | 'direct'
export type AiLength = 'short' | 'medium' | 'long'
export type RecipientStatus = 'pending' | 'sent' | 'failed'

export interface Lead {
  id: string
  user_id: string
  email: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  organization_name: string | null
  organization_title: string | null
  organization_department: string | null
  status: LeadStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeadNote {
  id: string
  lead_id: string
  user_id: string
  content: string
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  attachments?: ProductAttachment[]
}

export interface ProductAttachment {
  id: string
  product_id: string
  file_name: string
  storage_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  type: TemplateType
  subject: string | null
  body: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  status: CampaignStatus
  audience_type: AudienceType
  template_id: string | null
  product_id: string | null
  ai_tone: AiTone
  ai_length: AiLength
  subject: string | null
  body: string | null
  emails_sent: number
  created_at: string
  sent_at: string | null
  template?: Template
  product?: Product
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  lead_id: string
  status: RecipientStatus
  sent_at: string | null
  lead?: Lead
  is_opened?: boolean
  opened_at?: string | null
  open_count?: number
}

export interface CampaignAttachment {
  id: string
  campaign_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  created_at: string
}

export interface GenerateEmailInput {
  lead: {
    firstName: string | null
    lastName: string | null
    organization: string | null
    title: string | null
    department: string | null
    email: string
  }
  product: {
    name: string
    description: string | null
  } | null
  template: {
    type: TemplateType
    subject: string | null
    body: string | null
  } | null
  tone: AiTone
  length: AiLength
}

export interface GenerateEmailOutput {
  subject: string
  body: string
}

export interface NavItem {
  href: string
  label: string
  icon: string
}

export interface DashboardStats {
  totalLeads: number
  totalCampaigns: number
  emailsSent: number
  potentialCustomers: number
  customers: number
}

export interface LeadMessage {
  id: string
  lead_id: string
  user_id: string
  sender: 'lead' | 'user' | 'ai'
  subject: string | null
  body: string
  gmail_message_id: string | null
  gmail_thread_id: string | null
  created_at: string
}


import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { generateEmail } from '@/lib/ai/generate-email'
import type { AiTone, AiLength, TemplateType } from '@/types'

// Default daily email limit (configurable via env var)
const DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || '450', 10)

// Replace template placeholders with actual lead data
function personalizePlaceholders(text: string, lead: any): string {
  const firstName = lead.first_name || ''
  const lastName = lead.last_name || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'there'
  const company = lead.organization_name || ''
  const title = lead.organization_title || ''
  const department = lead.organization_department || ''

  return text
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{lastName\}\}/gi, lastName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{full_name\}\}/gi, fullName)
    .replace(/\{\{name\}\}/gi, fullName)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{organization\}\}/gi, company)
    .replace(/\{\{title\}\}/gi, title)
    .replace(/\{\{department\}\}/gi, department)
}

// Get how many emails were sent today across ALL campaigns for this user
async function getEmailsSentToday(supabase: any, userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', todayStart.toISOString())
    .not('sent_at', 'is', null)

  return count || 0
}

// Add days to a date and return ISO date string (YYYY-MM-DD)
function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let attachments: any[] | undefined = undefined
  try {
    const jsonBody = await req.json()
    attachments = jsonBody?.attachments
  } catch {
    // Body might be empty
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { error: 'GMAIL_USER or GMAIL_APP_PASSWORD is not configured in .env.local.' },
      { status: 500 }
    )
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*, template:templates(*), product:products(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Campaign already fully sent' }, { status: 400 })
  }

  // --- Load leads ---
  let leadsQuery = supabase.from('leads').select('*').eq('user_id', user.id)

  if (campaign.audience_type === 'potential_customers') {
    leadsQuery = leadsQuery.eq('status', 'potential_customer')
  } else if (campaign.audience_type === 'selected') {
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('lead_id')
      .eq('campaign_id', campaign.id)
    const leadIds = recipients?.map((r: { lead_id: string }) => r.lead_id) || []
    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 })
    }
    leadsQuery = leadsQuery.in('id', leadIds)
  }

  const { data: allLeads, error: leadsError } = await leadsQuery
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })
  if (!allLeads || allLeads.length === 0) {
    return NextResponse.json({ error: 'No leads found for this audience' }, { status: 400 })
  }

  // --- Filter out leads that were already sent to for this campaign ---
  const { data: alreadySentRecords } = await supabase
    .from('campaign_recipients')
    .select('lead_id')
    .eq('campaign_id', campaign.id)
    .eq('status', 'sent')

  const alreadySentIds = new Set((alreadySentRecords || []).map((r: any) => r.lead_id))
  const remainingLeads = allLeads.filter((l: any) => !alreadySentIds.has(l.id))

  if (remainingLeads.length === 0) {
    return NextResponse.json({ error: 'All leads in this campaign have already been emailed.' }, { status: 400 })
  }

  // --- Calculate today's remaining quota ---
  const sentToday = await getEmailsSentToday(supabase, user.id)
  const remainingQuota = Math.max(0, DAILY_LIMIT - sentToday)

  if (remainingQuota === 0) {
    return NextResponse.json({
      error: `Daily email limit of ${DAILY_LIMIT} reached. Please try again tomorrow.`,
      dailyLimitReached: true,
      sentToday,
      dailyLimit: DAILY_LIMIT,
      queued: remainingLeads.length,
    }, { status: 429 })
  }

  // --- Split into today's batch and queued batches ---
  const todayBatch = remainingLeads.slice(0, remainingQuota)
  const queuedLeads = remainingLeads.slice(remainingQuota)

  await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)

  let emailsSent = 0
  let emailsFailed = 0
  const errors: string[] = []
  const today = new Date()

  // --- Send today's batch ---
  for (const lead of todayBatch) {
    try {
      let subject = campaign.subject || 'Hello from our team'
      let body = campaign.body || ''

      // ALWAYS generate a fresh personalized email per lead when AI is available.
      // campaign.body may have been saved from a preview (with a different person's name),
      // so we must NOT reuse it directly — pass it as a template hint to the AI instead.
      if (process.env.OPENROUTER_API_KEY) {
        const generated = await generateEmail({
          lead: {
            firstName: lead.first_name,
            lastName: lead.last_name,
            organization: lead.organization_name,
            title: lead.organization_title,
            department: lead.organization_department,
            email: lead.email,
          },
          product: campaign.product
            ? { name: campaign.product.name, description: campaign.product.description }
            : null,
          // Pass saved body as a template hint so AI keeps the style/structure
          template: {
            type: (campaign.template?.type ?? 'custom') as TemplateType,
            subject: campaign.subject || campaign.template?.subject || '',
            body: campaign.body || campaign.template?.body || '',
          },
          tone: campaign.ai_tone as AiTone,
          length: campaign.ai_length as AiLength,
        })
        subject = generated.subject
        body = generated.body
      }

      // Fallback: replace any remaining {{placeholders}} with lead data
      subject = personalizePlaceholders(subject, lead)
      body = personalizePlaceholders(body, lead)

      const result = await sendEmail({ to: lead.email, subject, body, attachments })

      await supabase.from('campaign_recipients').upsert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error,
        scheduled_for: null,
      }, { onConflict: 'campaign_id,lead_id' })

      if (result.success) {
        emailsSent++
      } else {
        emailsFailed++
        errors.push(`${lead.email}: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      emailsFailed++
      errors.push(`${lead.email}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // --- Schedule queued batches for future days ---
  let queuedCount = 0
  if (queuedLeads.length > 0) {
    // Group into batches of DAILY_LIMIT, starting from tomorrow
    let dayOffset = 1
    let batchStart = 0

    while (batchStart < queuedLeads.length) {
      const batchLeads = queuedLeads.slice(batchStart, batchStart + DAILY_LIMIT)
      const scheduledDate = addDays(today, dayOffset)

      const queueRows = batchLeads.map((lead: any) => ({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: 'pending',
        scheduled_for: scheduledDate,
        sent_at: null,
        error_message: null,
      }))

      await supabase.from('campaign_recipients').upsert(queueRows, { onConflict: 'campaign_id,lead_id' })

      queuedCount += batchLeads.length
      batchStart += DAILY_LIMIT
      dayOffset++
    }
  }

  // --- Update campaign status ---
  const hasMorePending = queuedLeads.length > 0
  const finalStatus = hasMorePending ? 'sending' : (emailsSent > 0 ? 'sent' : 'failed')

  await supabase
    .from('campaigns')
    .update({
      status: finalStatus,
      emails_sent: (campaign.emails_sent || 0) + emailsSent,
      ...(finalStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}),
    })
    .eq('id', campaign.id)

  const daysToComplete = queuedLeads.length > 0
    ? Math.ceil(queuedLeads.length / DAILY_LIMIT) + 1
    : 1

  return NextResponse.json({
    success: emailsSent > 0,
    emailsSent,
    emailsFailed,
    sentToday: sentToday + emailsSent,
    dailyLimit: DAILY_LIMIT,
    queued: queuedCount,
    daysToComplete,
    totalLeads: allLeads.length,
    hasQueue: hasMorePending,
    ...(errors.length > 0 && {
      errorSummary: `${emailsFailed} email(s) failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` ...and ${errors.length - 3} more` : ''}`
    }),
  })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { generateEmail } from '@/lib/ai/generate-email'
import type { AiTone, AiLength, TemplateType } from '@/types'

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

async function getEmailsSentToday(supabase: any): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', todayStart.toISOString())
  return count || 0
}

// GET: Return pending queue batches for a campaign
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to this user
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, emails_sent')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Get all pending recipients grouped by scheduled_for
  const { data: pendingRecipients } = await supabase
    .from('campaign_recipients')
    .select('id, lead_id, scheduled_for')
    .eq('campaign_id', id)
    .eq('status', 'pending')
    .not('scheduled_for', 'is', null)
    .order('scheduled_for', { ascending: true })

  // Group by date
  const batchMap: Record<string, number> = {}
  for (const r of (pendingRecipients || [])) {
    const day = r.scheduled_for as string
    batchMap[day] = (batchMap[day] || 0) + 1
  }

  const batches = Object.entries(batchMap).map(([date, count]) => ({ date, count }))

  const sentToday = await getEmailsSentToday(supabase)
  const remainingQuota = Math.max(0, DAILY_LIMIT - sentToday)

  return NextResponse.json({
    campaignId: id,
    totalPending: pendingRecipients?.length || 0,
    batches,
    sentToday,
    dailyLimit: DAILY_LIMIT,
    remainingQuota,
  })
}

// POST: Send next available batch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let attachments: any[] | undefined
  try {
    const body = await req.json()
    attachments = body?.attachments
  } catch { /* empty */ }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: 'Gmail credentials not configured.' }, { status: 500 })
  }

  // Verify campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, template:templates(*), product:products(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Check today's quota
  const sentToday = await getEmailsSentToday(supabase)
  const remainingQuota = Math.max(0, DAILY_LIMIT - sentToday)

  if (remainingQuota === 0) {
    return NextResponse.json({
      error: `Daily limit of ${DAILY_LIMIT} emails reached. Try again tomorrow.`,
      dailyLimitReached: true,
      sentToday,
      dailyLimit: DAILY_LIMIT,
    }, { status: 429 })
  }

  // Get the next scheduled batch (earliest future date)
  const { data: nextBatchRecords } = await supabase
    .from('campaign_recipients')
    .select('id, lead_id, scheduled_for')
    .eq('campaign_id', id)
    .eq('status', 'pending')
    .not('scheduled_for', 'is', null)
    .order('scheduled_for', { ascending: true })
    .limit(remainingQuota)

  if (!nextBatchRecords || nextBatchRecords.length === 0) {
    return NextResponse.json({ error: 'No pending emails in queue for this campaign.' }, { status: 400 })
  }

  // Get lead IDs
  const leadIds = nextBatchRecords.map((r: any) => r.lead_id)
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .in('id', leadIds)

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: 'Could not load lead data.' }, { status: 500 })
  }

  const leadMap = new Map(leads.map((l: any) => [l.id, l]))

  // Fetch campaign attachments from DB
  const { data: dbAttachments } = await supabase
    .from('campaign_attachments')
    .select('*')
    .eq('campaign_id', campaign.id)

  const inlineImgRecord = dbAttachments?.find((a: any) => a.mime_type === 'inline_image')
  const inlineImage = inlineImgRecord
    ? { filename: inlineImgRecord.file_name, content: inlineImgRecord.storage_path }
    : undefined

  const normalAttachments = dbAttachments
    ?.filter((a: any) => a.mime_type !== 'inline_image')
    .map((a: any) => ({
      filename: a.file_name,
      content: Buffer.from(a.storage_path, 'base64'),
    })) || []

  const requestAttachments = attachments?.map((a: any) => ({
    filename: a.filename || a.file_name,
    content: Buffer.from(a.content || a.storage_path, 'base64')
  })) || []

  const mergedAttachments = [...normalAttachments, ...requestAttachments]

  let emailsSent = 0
  let emailsFailed = 0
  const errors: string[] = []

  for (const record of nextBatchRecords) {
    const lead = leadMap.get(record.lead_id)
    if (!lead) continue

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

      const result = await sendEmail({
        to: lead.email,
        subject,
        body,
        attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined,
        inlineImage
      })

      await supabase
        .from('campaign_recipients')
        .update({
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.success ? null : result.error,
          scheduled_for: null,
        })
        .eq('id', record.id)

      if (result.success) {
        emailsSent++
      } else {
        emailsFailed++
        errors.push(`${lead.email}: ${result.error}`)
      }
    } catch (err: any) {
      emailsFailed++
      errors.push(`${lead.email}: ${err.message}`)
      await supabase
        .from('campaign_recipients')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', record.id)
    }
  }

  // Update emails_sent count on campaign
  const newTotal = (campaign.emails_sent || 0) + emailsSent
  const { data: remainingPending } = await supabase
    .from('campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .eq('status', 'pending')

  const stillPending = (remainingPending as any)?.length || 0
  const finalStatus = stillPending === 0 ? 'sent' : 'sending'

  await supabase
    .from('campaigns')
    .update({
      emails_sent: newTotal,
      status: finalStatus,
      ...(finalStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)

  return NextResponse.json({
    success: emailsSent > 0,
    emailsSent,
    emailsFailed,
    sentToday: sentToday + emailsSent,
    dailyLimit: DAILY_LIMIT,
    campaignComplete: finalStatus === 'sent',
    ...(errors.length > 0 && {
      errorSummary: `${emailsFailed} failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` +${errors.length - 3} more` : ''}`
    }),
  })
}

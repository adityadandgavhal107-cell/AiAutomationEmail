import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { generateEmail } from '@/lib/ai/generate-email'
import type { AiTone, AiLength, TemplateType } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log(`[SEND_ROUTE] Incoming request for campaign ID: ${id}`)

  let attachments: any[] | undefined = undefined
  try {
    const jsonBody = await req.json()
    attachments = jsonBody?.attachments
  } catch (e) {
    // Body might be empty
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('[SEND_ROUTE] Unauthorized (no user)')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check Gmail credentials early
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[SEND_ROUTE] Missing Gmail credentials')
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
    console.log(`[SEND_ROUTE] Campaign not found. Error: ${campaignError?.message}, ID: ${id}, UserID: ${user.id}`)
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status === 'sent') {
    console.log(`[SEND_ROUTE] Campaign already sent`)
    return NextResponse.json({ error: 'Campaign already sent' }, { status: 400 })
  }

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

  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: 'No leads found for this audience' }, { status: 400 })
  }

  await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)

  let emailsSent = 0
  let emailsFailed = 0
  const results = []
  const errors: string[] = []

  for (const lead of leads) {
    try {
      let subject = campaign.subject || 'Hello from our team'
      let body = campaign.body || ''

      if (!body && process.env.OPENROUTER_API_KEY) {
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
          template: campaign.template
            ? {
                type: campaign.template.type as TemplateType,
                subject: campaign.template.subject,
                body: campaign.template.body,
              }
            : null,
          tone: campaign.ai_tone as AiTone,
          length: campaign.ai_length as AiLength,
        })
        subject = generated.subject
        body = generated.body
      }

      const result = await sendEmail({ to: lead.email, subject, body, attachments })

      await supabase.from('campaign_recipients').upsert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
      })

      if (result.success) {
        emailsSent++
      } else {
        emailsFailed++
        const errMsg = `${lead.email}: ${result.error || 'Unknown error'}`
        errors.push(errMsg)
      }
      results.push({ email: lead.email, success: result.success, error: result.error })
    } catch (err) {
      emailsFailed++
      const errMsg = `${lead.email}: ${err instanceof Error ? err.message : String(err)}`
      errors.push(errMsg)
      results.push({ email: lead.email, success: false, error: String(err) })
    }
  }

  const finalStatus = emailsSent > 0 ? 'sent' : 'failed'
  await supabase
    .from('campaigns')
    .update({
      status: finalStatus,
      emails_sent: emailsSent,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  return NextResponse.json({
    success: emailsSent > 0,
    emailsSent,
    emailsFailed,
    total: leads.length,
    results,
    ...(errors.length > 0 && {
      errorSummary: `${emailsFailed} email(s) failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` ...and ${errors.length - 3} more` : ''}`
    }),
  })
}

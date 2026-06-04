import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('lead_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { body, subject } = await request.json()

  if (!body) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('email, first_name, last_name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const mailSubject = subject || 'Re: Outreach Conversation'

  // Send email via Gmail SMTP
  const sendResult = await sendEmail({
    to: lead.email,
    subject: mailSubject,
    body: body,
  })

  if (!sendResult.success) {
    return NextResponse.json({ error: sendResult.error || 'Failed to send email' }, { status: 500 })
  }

  // Insert sent message into DB
  const { data, error } = await supabase
    .from('lead_messages')
    .insert({
      lead_id: id,
      user_id: user.id,
      sender: 'user',
      subject: mailSubject,
      body: body,
      gmail_message_id: sendResult.messageId || `sent_msg_${Date.now()}`,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

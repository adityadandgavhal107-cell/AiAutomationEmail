import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('campaigns')
    .select('*, template:templates(id,name,type), product:products(id,name)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: body.name,
      status: 'draft',
      audience_type: body.audience_type || 'all',
      template_id: body.template_id || null,
      product_id: body.product_id || null,
      ai_tone: body.ai_tone || 'professional',
      ai_length: body.ai_length || 'medium',
      subject: body.subject || null,
      body: body.body || null,
      emails_sent: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.audience_type === 'selected' && Array.isArray(body.selected_lead_ids) && body.selected_lead_ids.length > 0) {
    const recipientRows = body.selected_lead_ids.map((leadId: string) => ({
      campaign_id: data.id,
      lead_id: leadId,
      status: 'pending',
    }))
    const { error: recipientError } = await supabase
      .from('campaign_recipients')
      .insert(recipientRows)

    if (recipientError) {
      // Clean up the campaign so we don't leave a broken campaign draft
      await supabase.from('campaigns').delete().eq('id', data.id)
      return NextResponse.json({ error: recipientError.message }, { status: 500 })
    }
  }

  return NextResponse.json(data, { status: 201 })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('campaigns')
    .select('*, template:templates(*), product:products(*), attachments:campaign_attachments(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { attachments, inlineImage, ...campaignFields } = body

  const { data, error } = await supabase
    .from('campaigns')
    .update(campaignFields)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.hasOwnProperty('attachments') || body.hasOwnProperty('inlineImage')) {
    await supabase.from('campaign_attachments').delete().eq('campaign_id', id)

    const attachmentRows: any[] = []
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((att: any) => {
        attachmentRows.push({
          campaign_id: id,
          file_name: att.filename || att.file_name || 'attachment',
          storage_path: att.content || att.storage_path || '',
          mime_type: 'attachment'
        })
      })
    }

    if (inlineImage && inlineImage.content) {
      attachmentRows.push({
        campaign_id: id,
        file_name: inlineImage.filename || 'inline_image.png',
        storage_path: inlineImage.content,
        mime_type: 'inline_image'
      })
    }

    if (attachmentRows.length > 0) {
      const { error: attError } = await supabase
        .from('campaign_attachments')
        .insert(attachmentRows)
      if (attError) return NextResponse.json({ error: attError.message }, { status: 500 })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

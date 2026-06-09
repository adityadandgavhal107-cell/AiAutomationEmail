import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('products')
    .select('*, attachments:product_attachments(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description } = body

  if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('products')
    .insert({ name, description, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
    const attachmentRows = body.attachments.map((a: any) => ({
      product_id: data.id,
      file_name: a.filename || a.file_name || 'attachment',
      storage_path: a.content || a.storage_path || '',
      file_size: a.file_size || null,
      mime_type: a.mime_type || null
    }))
    const { error: attError } = await supabase
      .from('product_attachments')
      .insert(attachmentRows)
    if (attError) return NextResponse.json({ error: attError.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

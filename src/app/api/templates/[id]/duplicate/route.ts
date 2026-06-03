import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // 1. Fetch template
  const { data: original, error: fetchError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // 2. Insert copy
  const { data: copy, error: insertError } = await supabase
    .from('templates')
    .insert({
      name: `${original.name} (Copy)`,
      type: original.type,
      subject: original.subject,
      body: original.body,
      user_id: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ data: copy }, { status: 201 })
}

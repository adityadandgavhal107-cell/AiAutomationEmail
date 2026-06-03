import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCsvFile } from '@/lib/csv/parse-leads'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const { leads, errors, total } = await parseCsvFile(file)

  if (leads.length === 0) {
    return NextResponse.json({ error: 'No valid leads found', errors }, { status: 400 })
  }

  const rows = leads.map((l: any) => ({ ...l, user_id: user.id, status: 'new' }))

  const { data, error } = await supabase
    .from('leads')
    .upsert(rows, { onConflict: 'user_id,email', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    imported: data?.length ?? 0,
    skipped: total - leads.length,
    errors,
  }, { status: 201 })
}

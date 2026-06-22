import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    try {
      // Use service role client to bypass RLS for public/anonymous pixel request
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Fetch current open count
      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('open_count')
        .eq('id', id)
        .single()

      const currentCount = recipient?.open_count || 0

      // Update open status and increment count
      await supabase
        .from('campaign_recipients')
        .update({
          is_opened: true,
          opened_at: new Date().toISOString(),
          open_count: currentCount + 1,
        })
        .eq('id', id)
    } catch (err) {
      console.error('[TRACK_OPEN_ERROR]', err)
    }
  }

  // base64 transparent 1x1 PNG image
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  )

  return new NextResponse(pixel, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

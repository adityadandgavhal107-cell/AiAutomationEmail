import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateEmail } from '@/lib/ai/generate-email'
import type { AiTone, AiLength, TemplateType } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { lead, product, template, tone, length } = body

  if (!lead || !lead.email) {
    return NextResponse.json({ error: 'Lead email is required' }, { status: 400 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })
  }

  try {
    const result = await generateEmail({
      lead: {
        firstName: lead.first_name || lead.firstName || null,
        lastName: lead.last_name || lead.lastName || null,
        organization: lead.organization_name || lead.organization || null,
        title: lead.organization_title || lead.title || null,
        department: lead.organization_department || lead.department || null,
        email: lead.email,
      },
      product: product ? { name: product.name, description: product.description } : null,
      template: template
        ? { type: template.type as TemplateType, subject: template.subject, body: template.body }
        : null,
      tone: (tone || 'professional') as AiTone,
      length: (length || 'medium') as AiLength,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI generation failed' },
      { status: 500 }
    )
  }
}

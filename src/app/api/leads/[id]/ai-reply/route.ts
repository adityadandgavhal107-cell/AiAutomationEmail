import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // 1. Fetch lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // 2. Fetch history
  const { data: messages, error: msgsError } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('lead_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (msgsError) return NextResponse.json({ error: msgsError.message }, { status: 500 })

  // 3. Set up AI prompt
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured in environment variables' }, { status: 400 })
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

  // Format history
  const formattedHistory = messages && messages.length > 0
    ? messages.map((m: any) => `[${m.sender === 'user' ? 'Outreach Representative (You)' : 'Lead (' + (lead.first_name || lead.email) + ')'}]: ${m.body}`).join('\n\n')
    : '(No prior messages in database)'

  const leadDetails = `
Lead Name: ${lead.first_name || ''} ${lead.last_name || ''}
Lead Email: ${lead.email}
Company: ${lead.organization_name || 'Not specified'}
Job Title: ${lead.organization_title || 'Not specified'}
Department: ${lead.organization_department || 'Not specified'}
Internal notes: ${lead.notes || 'None'}
  `.trim()

  const systemPrompt = `You are an expert sales representative and AI assistant. Your goal is to draft a high-converting, professional, and personalized follow-up or reply email.
  
Lead Details:
${leadDetails}

Conversation History (ordered chronologically):
${formattedHistory}

INSTRUCTIONS:
1. Carefully analyze the last message received from the lead.
2. Formulate a response that directly answers their queries, addresses their concerns, or encourages setting up a call.
3. Maintain a warm, professional, helpful, and concise tone.
4. Do NOT include email placeholders like "[Your Name]" or generic signatures. Sign off using the representative's name or company if available, or just a simple call to action.
5. Provide the output in JSON format:
{
  "subject": "Suggested subject line (usually starting with Re: if it is a reply)",
  "body": "The complete draft of your email response. Use \\n for line breaks."
}`

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Outreach Automation Platform',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Please generate the suggested reply based on the conversation history above.',
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json({ error: `OpenRouter API error: ${errorText}` }, { status: 500 })
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    return NextResponse.json({ error: 'No response content returned from OpenRouter' }, { status: 500 })
  }

  try {
    const parsed = JSON.parse(content)
    return NextResponse.json({ subject: parsed.subject, body: parsed.body })
  } catch {
    return NextResponse.json({ subject: 'Re: Follow up', body: content })
  }
}

import { type GenerateEmailInput, type GenerateEmailOutput } from '@/types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function buildSystemPrompt(tone: string, length: string): string {
  const toneInstructions: Record<string, string> = {
    professional: 'Use a polished, professional tone. Maintain business etiquette.',
    friendly: 'Use a warm, conversational, and approachable tone. Be personable.',
    formal: 'Use a strictly formal tone with proper salutations and closings.',
    startup: 'Use an energetic, innovative, and slightly casual startup tone. Be bold.',
    direct: 'Be concise and direct. Get to the point quickly. No fluff.',
  }

  const lengthInstructions: Record<string, string> = {
    short: 'Keep the email very concise — 3 to 5 sentences maximum.',
    medium: 'Write a moderate-length email — around 100 to 150 words.',
    long: 'Write a detailed email — around 200 to 300 words with thorough context.',
  }

  // Build real sender signature from env
  const senderName = process.env.RESEND_FROM_NAME || 'Your Name'
  const senderEmail = process.env.RESEND_FROM_EMAIL || ''
  const senderTitle = process.env.SENDER_JOB_TITLE || ''
  const senderCompany = process.env.SENDER_COMPANY || process.env.RESEND_FROM_NAME || ''
  const senderPhone = process.env.SENDER_PHONE || ''

  const signatureBlock = [
    `Best regards,`,
    senderName,
    senderTitle,
    senderCompany,
    senderPhone,
    senderEmail,
  ].filter(Boolean).join('\n')

  return `You are an expert B2B sales and outreach copywriter.

Your task is to write a highly personalized cold outreach email.

Tone: ${toneInstructions[tone] || toneInstructions.professional}
Length: ${lengthInstructions[length] || lengthInstructions.medium}

SENDER SIGNATURE (use EXACTLY as shown, never use placeholder brackets like [Your Name]):
${signatureBlock}

CRITICAL RULES:
1. Read the product description carefully and extract the most RELEVANT selling points for this specific recipient based on their role, department, and organization.
2. Do NOT dump all product information — pick 1-3 key points that resonate most with this recipient's likely pain points.
3. Personalize the opening based on the recipient's name, company, and role.
4. Make the email feel human, not templated.
5. End with a clear, low-friction call to action.
6. Generate a compelling subject line (under 60 characters).
7. NEVER use placeholder text like [Your Name], [Your Company], [Your Phone Number] etc. Always use the real sender info provided above.

Respond ONLY in this exact JSON format:
{
  "subject": "Your subject line here",
  "body": "Your email body here with proper line breaks using \\n"
}`
}

function buildUserPrompt(input: GenerateEmailInput): string {
  const { lead, product, template, tone, length } = input

  const leadInfo = `
RECIPIENT INFORMATION:
- Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'}
- Email: ${lead.email}
- Job Title: ${lead.title || 'Not specified'}
- Department: ${lead.department || 'Not specified'}
- Company: ${lead.organization || 'Not specified'}
`.trim()

  const productInfo = product
    ? `
PRODUCT INFORMATION:
- Product Name: ${product.name}
- Full Description: ${product.description || 'No description provided'}

(Extract the most relevant points for this recipient from the description above)
`.trim()
    : 'No product selected — write a general outreach email based on the template context.'

  const templateInfo = template
    ? `
TEMPLATE GUIDANCE (use as structural inspiration, not a rigid script):
- Template Type: ${template.type?.replace(/_/g, ' ')}
- Subject Hint: ${template.subject || 'Generate a fresh subject line'}
- Body Structure Hint: ${template.body || 'No specific structure provided'}
`.trim()
    : 'No template — generate a fresh cold outreach email.'

  return `${leadInfo}

${productInfo}

${templateInfo}

Now write a personalized ${tone} ${length}-length outreach email for this recipient.`
}

export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'PROSMART-AI  Automation Platform',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(input.tone, input.length),
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} — ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No content returned from AI')
  }

  try {
    const parsed = JSON.parse(content) as GenerateEmailOutput
    if (!parsed.subject || !parsed.body) {
      throw new Error('Invalid AI response structure')
    }
    return parsed
  } catch {
    throw new Error('Failed to parse AI response as JSON')
  }
}

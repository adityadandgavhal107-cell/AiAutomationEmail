import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  fromEmail?: string
  fromName?: string
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const from = `${options.fromName || process.env.RESEND_FROM_NAME || 'Outreach'} <${
    options.fromEmail || process.env.RESEND_FROM_EMAIL || 'outreach@yourdomain.com'
  }>`

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.body.replace(/\n/g, '<br/>'),
      text: options.body,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending email',
    }
  }
}

export async function sendBatchEmails(
  emails: SendEmailOptions[],
  delayMs = 100
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = []

  for (const email of emails) {
    const result = await sendEmail(email)
    results.push(result)
    if (delayMs > 0 && emails.indexOf(email) < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}

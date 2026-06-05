import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const senderName = options.fromName || process.env.GMAIL_FROM_NAME || process.env.RESEND_FROM_NAME || 'Prosmart Concepts'
  // Use GMAIL_FROM_EMAIL if set (for sending via Gmail alias like products@prosmart.in),
  // otherwise fall back to the authenticated Gmail account.
  const senderEmail = process.env.GMAIL_FROM_EMAIL || process.env.GMAIL_USER
  const from = `${senderName} <${senderEmail}>`
  const replyTo = options.replyTo || process.env.REPLY_TO_EMAIL || process.env.GMAIL_USER

  try {
    const info = await transporter.sendMail({
      from,
      replyTo,
      to: options.to,
      subject: options.subject,
      html: options.body.replace(/\n/g, '<br/>'),
      text: options.body,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    })

    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unknown error sending email via Gmail',
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

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
  inlineImage?: {
    filename: string
    content: string
  }
  trackingId?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const senderName = options.fromName || process.env.GMAIL_FROM_NAME || process.env.RESEND_FROM_NAME || 'Prosmart Concepts'
  const senderEmail = process.env.GMAIL_FROM_EMAIL || process.env.GMAIL_USER
  const from = `${senderName} <${senderEmail}>`
  const replyTo = options.replyTo || process.env.REPLY_TO_EMAIL || process.env.GMAIL_USER

  try {
    const mailAttachments = options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })) || []

    let htmlBody = options.body.replace(/\n/g, '<br/>')

    if (options.inlineImage) {
      htmlBody = `<img src="cid:inline_image" style="max-width:100%; height:auto; display:block; margin:0 auto 20px auto; border-radius:8px;" /><br/>` + htmlBody
      mailAttachments.push({
        filename: options.inlineImage.filename,
        content: Buffer.from(options.inlineImage.content, 'base64'),
        cid: 'inline_image',
      } as any)
    }

    if (options.trackingId) {
      const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/track-open?id=${options.trackingId}`
      htmlBody += `<br/><img src="${trackingUrl}" width="1" height="1" style="display:none; width:1px; height:1px;" alt="" />`
    }

    const info = await transporter.sendMail({
      from,
      replyTo,
      to: options.to,
      subject: options.subject,
      html: htmlBody,
      text: options.body,
      attachments: mailAttachments,
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

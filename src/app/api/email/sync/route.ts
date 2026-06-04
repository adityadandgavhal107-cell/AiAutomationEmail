import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// Helper to extract only the direct reply text, stripping out original quoted thread
function cleanEmailBody(text: string): string {
  if (!text) return ''
  const lines = text.split('\n')
  const cleanedLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    // Stop at common quote headers
    if (
      trimmed.startsWith('>') ||
      trimmed.startsWith('-----Original Message-----') ||
      (trimmed.startsWith('On ') && trimmed.includes('wrote:')) ||
      trimmed.startsWith('From: ') ||
      trimmed.startsWith('To: ') ||
      trimmed.startsWith('Sent: ') ||
      trimmed.startsWith('Subject: ')
    ) {
      break
    }
    cleanedLines.push(line)
  }
  const result = cleanedLines.join('\n').trim()
  return result || text.trim() // fallback to full text if cleaning resulted in empty string
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPass) {
    return NextResponse.json(
      { error: 'Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to your .env.local' },
      { status: 400 }
    )
  }

  // Fetch all user's leads to match incoming senders
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, email, status')
    .eq('user_id', user.id)

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: 'No leads found to sync replies for.', synced: 0, converted: 0 })
  }

  // Map email addresses to lead details (case-insensitive keys)
  const leadMap = new Map(leads.map(l => [l.email.toLowerCase().trim(), l]))

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
    logger: false,
  })

  let syncedCount = 0
  let convertedCount = 0
  const syncedMessages: any[] = []

  try {
    await client.connect()

    const lock = await client.getMailboxLock('INBOX')
    try {
      // Search for messages received in the last 14 days
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 14)
      const searchResults = await client.search({ since: sinceDate })

      // Fetch messages details
      if (searchResults && Array.isArray(searchResults)) {
        for (const uid of searchResults) {
          const message = await client.fetchOne(uid, { source: true, envelope: true, uid: true })
          if (!message || !message.source) continue

          const parsed = await simpleParser(message.source)
          const fromAddress = parsed.from?.value[0]?.address?.toLowerCase().trim()
          if (!fromAddress) continue

          const matchingLead = leadMap.get(fromAddress)
          if (matchingLead) {
            const gmailMessageId = parsed.messageId || `gmail_sync_${uid}_${parsed.date?.getTime() || Date.now()}`
            
            // Check if message is already in our DB to prevent duplication
            const { data: existingMsg } = await supabase
              .from('lead_messages')
              .select('id')
              .eq('gmail_message_id', gmailMessageId)
              .maybeSingle()

            if (existingMsg) continue

            const rawBody = parsed.text || parsed.textAsHtml || ''
            const cleanedBody = cleanEmailBody(rawBody)

            // Insert into lead_messages
            const { data: insertedMsg, error: insertError } = await supabase
              .from('lead_messages')
              .insert({
                lead_id: matchingLead.id,
                user_id: user.id,
                sender: 'lead',
                subject: parsed.subject || 'Re: Outreach',
                body: cleanedBody,
                gmail_message_id: gmailMessageId,
                created_at: parsed.date || new Date(),
              })
              .select()
              .single()

            if (!insertError && insertedMsg) {
              syncedCount++
              syncedMessages.push({
                leadId: matchingLead.id,
                email: matchingLead.email,
                subject: parsed.subject,
              })

              // Auto-promote lead status to 'potential_customer' if it is not customer
              if (matchingLead.status !== 'customer' && matchingLead.status !== 'potential_customer') {
                const { error: updateError } = await supabase
                  .from('leads')
                  .update({ status: 'potential_customer' })
                  .eq('id', matchingLead.id)

                if (!updateError) {
                  convertedCount++
                  // Update map status locally in case we process another email from the same lead in this batch
                  matchingLead.status = 'potential_customer'
                }
              }
            }
          }
        }
      }
    } finally {
      lock.release()
    }
  } catch (err: any) {
    console.error('[IMAP_SYNC_ERROR]', err)
    return NextResponse.json({ error: `Gmail sync failed: ${err.message}` }, { status: 500 })
  } finally {
    try {
      await client.logout()
    } catch {
      // Ignore logout errors
    }
  }

  return NextResponse.json({
    message: 'Gmail inbox synced successfully.',
    synced: syncedCount,
    converted: convertedCount,
    details: syncedMessages,
  })
}

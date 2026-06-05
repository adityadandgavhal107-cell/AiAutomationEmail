import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// Force Node.js runtime so imapflow can use net/tls (Edge runtime doesn't support these)
export const runtime = 'nodejs'

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

  // PRE-FETCH all existing gmail_message_ids for this user to avoid per-message DB queries
  const { data: existingMsgs } = await supabase
    .from('lead_messages')
    .select('gmail_message_id')
    .eq('user_id', user.id)

  const existingMsgIds = new Set((existingMsgs || []).map(m => m.gmail_message_id).filter(Boolean))

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

  // 25-second absolute timeout guard
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Sync timed out after 25 seconds. Please try again.')), 25000)
  )

  const syncPromise = async () => {
    await client.connect()

    const lock = await client.getMailboxLock('INBOX')
    try {
      // Reduced from 14 → 7 days for faster response
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 7)
      const searchResults = await client.search({ since: sinceDate })

      if (searchResults && Array.isArray(searchResults)) {
        // Process in batches to prevent memory spikes
        const MAX_PER_SYNC = 100
        const limited = searchResults.slice(-MAX_PER_SYNC) // most recent N

        if (limited.length > 0) {
          // Fetch envelopes in one fast batch request
          const messagesGen = client.fetch(limited.join(','), { envelope: true })

          for await (const msg of messagesGen) {
            const fromAddress = msg.envelope?.from?.[0]?.address?.toLowerCase().trim()
            if (!fromAddress) continue

            const matchingLead = leadMap.get(fromAddress)
            if (!matchingLead) continue

            const gmailMessageId = msg.envelope?.messageId || `gmail_sync_${msg.uid}_${msg.envelope?.date?.getTime() || Date.now()}`

            // Skip duplicates using pre-fetched set (no extra DB round-trip)
            if (existingMsgIds.has(gmailMessageId)) continue

            // Fetch the full source for this matching message only
            const fullMessage = await client.fetchOne(msg.uid, { source: true })
            if (!fullMessage || !fullMessage.source) continue

            const parsed = await simpleParser(fullMessage.source)
            const rawBody = parsed.text || parsed.textAsHtml || ''
            const cleanedBody = cleanEmailBody(rawBody)

            // Insert into lead_messages
            const { data: insertedMsg, error: insertError } = await supabase
              .from('lead_messages')
              .insert({
                lead_id: matchingLead.id,
                user_id: user.id,
                sender: 'lead',
                subject: parsed.subject || msg.envelope?.subject || 'Re: Outreach',
                body: cleanedBody,
                gmail_message_id: gmailMessageId,
                created_at: parsed.date || new Date(),
              })
              .select()
              .single()

            if (!insertError && insertedMsg) {
              syncedCount++
              existingMsgIds.add(gmailMessageId) // prevent duplicates in same run
              syncedMessages.push({
                leadId: matchingLead.id,
                email: matchingLead.email,
                subject: parsed.subject || msg.envelope?.subject || 'Re: Outreach',
              })

              // Auto-promote lead status to 'potential_customer' if it is not already customer
              if (matchingLead.status !== 'customer' && matchingLead.status !== 'potential_customer') {
                const { error: updateError } = await supabase
                  .from('leads')
                  .update({ status: 'potential_customer' })
                  .eq('id', matchingLead.id)

                if (!updateError) {
                  convertedCount++
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
  }

  try {
    await Promise.race([syncPromise(), timeoutPromise])
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

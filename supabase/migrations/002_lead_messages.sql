-- ============================================================
-- SQL Migration: Add Lead Messages Table for Conversation History
-- ============================================================

CREATE TYPE message_sender AS ENUM ('lead', 'user', 'ai');

CREATE TABLE lead_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender           message_sender NOT NULL,
  subject          TEXT,
  body             TEXT NOT NULL,
  gmail_message_id TEXT UNIQUE,
  gmail_thread_id  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX idx_lead_messages_lead_id ON lead_messages(lead_id);
CREATE INDEX idx_lead_messages_user_id ON lead_messages(user_id);
CREATE INDEX idx_lead_messages_gmail_message_id ON lead_messages(gmail_message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "lead_messages_select" ON lead_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lead_messages_insert" ON lead_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lead_messages_delete" ON lead_messages FOR DELETE USING (auth.uid() = user_id);

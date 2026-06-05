-- ============================================================
-- Migration 003: Add Queue Columns to Campaign Recipients
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS scheduled_for DATE,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_scheduled_for
  ON campaign_recipients(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status_scheduled
  ON campaign_recipients(campaign_id, status, scheduled_for);

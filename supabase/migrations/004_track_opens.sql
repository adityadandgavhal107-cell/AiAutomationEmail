-- ============================================================
-- SQL Migration 004: Add open tracking columns to campaign_recipients
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS is_opened BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;

-- Index for performance on queries filtering by open status
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_is_opened 
  ON campaign_recipients(is_opened);

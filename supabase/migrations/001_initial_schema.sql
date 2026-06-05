-- ============================================================
-- PROSMART EMAIL CRM Automation Platform — Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'follow_up',
  'potential_customer',
  'customer'
);

CREATE TYPE template_type AS ENUM (
  'cold_outreach',
  'follow_up_1',
  'follow_up_2',
  'partnership_proposal',
  'product_demo',
  'custom'
);

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'sending',
  'sent',
  'failed'
);

CREATE TYPE audience_type AS ENUM (
  'all',
  'selected',
  'potential_customers'
);

CREATE TYPE ai_tone AS ENUM (
  'professional',
  'friendly',
  'formal',
  'startup',
  'direct'
);

CREATE TYPE ai_length AS ENUM (
  'short',
  'medium',
  'long'
);

CREATE TYPE recipient_status AS ENUM (
  'pending',
  'sent',
  'failed'
);

-- ============================================================
-- LEADS
-- ============================================================

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  first_name      TEXT,
  middle_name     TEXT,
  last_name       TEXT,
  organization_name       TEXT,
  organization_title      TEXT,
  organization_department TEXT,
  status          lead_status NOT NULL DEFAULT 'new',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

CREATE INDEX idx_leads_user_id    ON leads(user_id);
CREATE INDEX idx_leads_status     ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- ============================================================
-- LEAD NOTES
-- ============================================================

CREATE TABLE lead_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_user_id ON products(user_id);

-- ============================================================
-- PRODUCT ATTACHMENTS
-- ============================================================

CREATE TABLE product_attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_attachments_product_id ON product_attachments(product_id);

-- ============================================================
-- TEMPLATES
-- ============================================================

CREATE TABLE templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       template_type NOT NULL DEFAULT 'cold_outreach',
  subject    TEXT,
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_user_id ON templates(user_id);

-- ============================================================
-- CAMPAIGNS
-- ============================================================

CREATE TABLE campaigns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  status        campaign_status NOT NULL DEFAULT 'draft',
  audience_type audience_type NOT NULL DEFAULT 'all',
  template_id   UUID REFERENCES templates(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  ai_tone       ai_tone NOT NULL DEFAULT 'professional',
  ai_length     ai_length NOT NULL DEFAULT 'medium',
  subject       TEXT,
  body          TEXT,
  emails_sent   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_user_id    ON campaigns(user_id);
CREATE INDEX idx_campaigns_status     ON campaigns(status);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- ============================================================
-- CAMPAIGN RECIPIENTS
-- ============================================================

CREATE TABLE campaign_recipients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status      recipient_status NOT NULL DEFAULT 'pending',
  sent_at     TIMESTAMPTZ,
  UNIQUE (campaign_id, lead_id)
);

CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_lead_id     ON campaign_recipients(lead_id);

-- ============================================================
-- CAMPAIGN ATTACHMENTS
-- ============================================================

CREATE TABLE campaign_attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_attachments_campaign_id ON campaign_attachments(campaign_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at    BEFORE UPDATE ON leads    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_attachments ENABLE ROW LEVEL SECURITY;

-- Leads RLS
CREATE POLICY "leads_select" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (auth.uid() = user_id);

-- Lead Notes RLS
CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lead_notes_insert" ON lead_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lead_notes_delete" ON lead_notes FOR DELETE USING (auth.uid() = user_id);

-- Products RLS
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.uid() = user_id);

-- Product Attachments RLS (join-based via products)
CREATE POLICY "product_attachments_select" ON product_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.user_id = auth.uid()));
CREATE POLICY "product_attachments_insert" ON product_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.user_id = auth.uid()));
CREATE POLICY "product_attachments_delete" ON product_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.user_id = auth.uid()));

-- Templates RLS
CREATE POLICY "templates_select" ON templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete" ON templates FOR DELETE USING (auth.uid() = user_id);

-- Campaigns RLS
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE USING (auth.uid() = user_id);

-- Campaign Recipients RLS
CREATE POLICY "campaign_recipients_select" ON campaign_recipients FOR SELECT
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "campaign_recipients_insert" ON campaign_recipients FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "campaign_recipients_update" ON campaign_recipients FOR UPDATE
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));

-- Campaign Attachments RLS
CREATE POLICY "campaign_attachments_select" ON campaign_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "campaign_attachments_insert" ON campaign_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "campaign_attachments_delete" ON campaign_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));

-- ============================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-attachments', 'product-attachments', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-attachments', 'campaign-attachments', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('csv-imports', 'csv-imports', false);

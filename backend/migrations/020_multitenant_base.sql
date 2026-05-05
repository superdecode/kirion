-- Migration 020: Multi-Tenant Base Tables
-- Run AFTER backing up the database.
-- Idempotent: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── Super Admins ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- ── Plans ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  modules JSONB NOT NULL DEFAULT '["dropscan"]',
  duration_days INTEGER,              -- NULL = recurring (managed via subscription expires_at)
  price_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plans (code, name, description, modules, duration_days, price_amount, price_currency)
VALUES
  ('trial_7d',  'Prueba 7 dias',  'Acceso completo a Drop Scan por 7 dias',  '["dropscan"]', 7,   0,      'USD'),
  ('basic',     'Basic',          'Drop Scan mensual',                         '["dropscan"]', NULL, 188.00, 'USD')
ON CONFLICT (code) DO NOTHING;

-- ── Tenants ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  legal_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','rejected','trial','trial_expired','active','expired','suspended')),
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  current_plan_id UUID REFERENCES plans(id),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ── Tenant Signup Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  country TEXT,
  raw_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES super_admins(id),
  reviewed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  resulting_tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON tenant_signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_email  ON tenant_signup_requests(contact_email);

-- ── Subscriptions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES super_admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ── Provisioning Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provisioning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID REFERENCES tenant_signup_requests(id),
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','failed','skipped')),
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_log_tenant ON provisioning_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_step   ON provisioning_log(step, status);

-- ── Notifications Outbox ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_code TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_outbox_status   ON notifications_outbox(status);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_tenant   ON notifications_outbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_created  ON notifications_outbox(created_at);

-- ── System Audit Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('super_admin','system')),
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_action ON system_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_created ON system_audit_log(created_at DESC);

-- ── updated_at trigger for plans ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_plans_ts ON plans;
CREATE TRIGGER update_plans_ts BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_ts ON tenants;
CREATE TRIGGER update_tenants_ts BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Legacy tenant seed ──────────────────────────────────────────────────────────
-- Replace 'LEGACY_TENANT_UUID' with the actual UUID from your app env LEGACY_TENANT_ID.
-- Run once manually or via migration runner:
-- INSERT INTO tenants (id, slug, legal_name, contact_name, contact_email, status, approved_at)
-- VALUES ('LEGACY_TENANT_UUID', 'legacy', 'Legacy Tenant', 'Admin', 'admin@legacy.local', 'active', now())
-- ON CONFLICT (id) DO NOTHING;

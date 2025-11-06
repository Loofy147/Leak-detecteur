-- LeakDetector Database Schema for Supabase

-- Users/Audits table
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  company_name TEXT,
  stripe_payment_id TEXT UNIQUE NOT NULL,
  plaid_access_token TEXT,
  plaid_item_id TEXT,
  status TEXT NOT NULL DEFAULT 'payment_received', -- payment_received, bank_connected, analyzing, completed, failed
  total_waste_found DECIMAL(10,2),
  report_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL, -- Plaid transaction ID
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  merchant_name TEXT NOT NULL,
  category TEXT[],
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT, -- monthly, annual, quarterly
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detected leaks table
CREATE TABLE leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  leak_type TEXT NOT NULL, -- zombie, duplicate, free_alternative, unused
  merchant_name TEXT NOT NULL,
  monthly_cost DECIMAL(10,2) NOT NULL,
  annual_cost DECIMAL(10,2) NOT NULL,
  last_charge_date DATE,
  description TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  evidence JSONB, -- Supporting transaction IDs, patterns, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_audits_email ON audits(email);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_transactions_audit_id ON transactions(audit_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_merchant ON transactions(merchant_name);
CREATE INDEX idx_leaks_audit_id ON leaks(audit_id);

-- Enable Row Level Security
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for now, service role can access everything)
CREATE POLICY "Service role can do anything" ON audits FOR ALL USING (true);
CREATE POLICY "Service role can do anything" ON transactions FOR ALL USING (true);
CREATE POLICY "Service role can do anything" ON leaks FOR ALL USING (true);

-- COMPLETE PRODUCTION SCHEMA
-- Run this AFTER the base leakdetector_schema.sql

-- ============================================
-- RATE LIMITING
-- ============================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_action ON rate_limits(action);
CREATE INDEX idx_rate_limits_created_at ON rate_limits(created_at);

-- Cleanup old rate limit records (run daily)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CIRCUIT BREAKER STATE
-- ============================================
CREATE TABLE circuit_breaker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_circuit_breaker_service ON circuit_breaker_states(service_name);
CREATE INDEX idx_circuit_breaker_state ON circuit_breaker_states(state);

-- ============================================
-- ERROR TRACKING
-- ============================================
CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_errors_type ON errors(error_type);
CREATE INDEX idx_errors_timestamp ON errors(timestamp DESC);

-- ============================================
-- METRICS & MONITORING
-- ============================================
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_metrics_name ON metrics(metric_name);
CREATE INDEX idx_metrics_created_at ON metrics(created_at DESC);

-- ============================================
-- ALERTS
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- ============================================
-- FUNNEL TRACKING
-- ============================================
CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id),
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_funnel_audit ON funnel_events(audit_id);
CREATE INDEX idx_funnel_type ON funnel_events(event_type);
CREATE INDEX idx_funnel_created_at ON funnel_events(created_at DESC);

-- ============================================
-- EMAIL QUEUE (for retry logic)
-- ============================================
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at DESC);

-- ============================================
-- MATERIALIZED VIEW FOR DASHBOARD
-- ============================================
CREATE MATERIALIZED VIEW audit_summaries AS
SELECT
  a.id,
  a.email,
  a.company_name,
  a.status,
  a.total_waste_found,
  a.created_at,
  a.completed_at,
  COUNT(DISTINCT t.id) as transaction_count,
  COUNT(DISTINCT l.id) as leak_count,
  COALESCE(SUM(l.annual_cost), 0) as total_annual_waste
FROM audits a
LEFT JOIN transactions t ON t.audit_id = a.id
LEFT JOIN leaks l ON l.audit_id = a.id
GROUP BY a.id;

CREATE UNIQUE INDEX idx_audit_summaries_id ON audit_summaries(id);

-- Refresh materialized view every hour
CREATE OR REPLACE FUNCTION refresh_audit_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY audit_summaries;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED JOBS (requires pg_cron extension)
-- ============================================

-- Enable pg_cron extension (run as superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup jobs
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *', -- Every hour
  'SELECT cleanup_old_rate_limits();'
);

SELECT cron.schedule(
  'refresh-dashboard',
  '0 * * * *', -- Every hour
  'SELECT refresh_audit_summaries();'
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on sensitive tables
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL USING (true);

CREATE POLICY "Service role full access" ON circuit_breaker_states
  FOR ALL USING (true);

CREATE POLICY "Service role full access" ON errors
  FOR ALL USING (true);

CREATE POLICY "Service role full access" ON metrics
  FOR ALL USING (true);

-- ============================================
-- BACKUP AND RECOVERY
-- ============================================

-- Function to check last backup time
CREATE OR REPLACE FUNCTION last_backup_time()
RETURNS TIMESTAMP AS $$
BEGIN
  -- This would integrate with your backup system
  -- For now, returns current time
  RETURN NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HEALTH CHECK FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION health_check()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'database', 'ok',
    'tables', (
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = 'public'
    ),
    'audits_count', (SELECT COUNT(*) FROM audits),
    'last_audit', (SELECT MAX(created_at) FROM audits),
    'circuit_breakers', (
      SELECT json_object_agg(service_name, state)
      FROM circuit_breaker_states
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATA INTEGRITY CHECKS
-- ============================================

-- Ensure no orphaned transactions
CREATE OR REPLACE FUNCTION check_orphaned_transactions()
RETURNS TABLE(transaction_id UUID, audit_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.audit_id
  FROM transactions t
  LEFT JOIN audits a ON a.id = t.audit_id
  WHERE a.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Ensure no orphaned leaks
CREATE OR REPLACE FUNCTION check_orphaned_leaks()
RETURNS TABLE(leak_id UUID, audit_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.audit_id
  FROM leaks l
  LEFT JOIN audits a ON a.id = l.audit_id
  WHERE a.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFY SCHEMA
-- ============================================

-- Run this to verify everything is set up correctly
DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'audits',
    'transactions',
    'leaks',
    'rate_limits',
    'circuit_breaker_states',
    'errors',
    'metrics',
    'alerts',
    'funnel_events',
    'email_queue'
  ];
  missing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(t)
  INTO missing_tables
  FROM UNNEST(required_tables) AS t
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = t
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'All required tables present';
  END IF;
END $$;

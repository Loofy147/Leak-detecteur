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
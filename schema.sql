-- A new, user-centric schema for LeakDetector

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  monthly_cost DECIMAL(10,2) NOT NULL,
  last_charge_date DATE,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, at_risk
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_merchant ON subscriptions(merchant_name);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

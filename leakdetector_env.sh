# LeakDetector Environment Variables

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_... # Create $497 one-time payment product

# Plaid
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret-key
PLAID_ENV=sandbox # Use 'sandbox' for testing, 'production' for live
NEXT_PUBLIC_PLAID_ENV=sandbox

# Anthropic Claude API (for AI analysis)
ANTHROPIC_API_KEY=sk-ant-...

# Email (Resend or SendGrid)
RESEND_API_KEY=re_...
FROM_EMAIL=reports@leakdetector.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Change to production URL when deployed
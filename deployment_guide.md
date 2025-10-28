# 🚀 LeakDetector - Complete Deployment Guide

## Prerequisites

- Node.js 18+ installed
- GitHub account
- Credit card for services (most have free tiers)

---

## Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com)
2. Create new project (free tier)
3. Wait for database to provision (~2 minutes)
4. Go to SQL Editor → New Query
5. Paste the entire **Database Schema** SQL code
6. Run it
7. Go to Project Settings → API
8. Copy these values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Set Up Stripe (Payments)

1. Go to [stripe.com](https://stripe.com)
2. Create account (or use test mode)
3. Dashboard → Developers → API Keys
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key → `STRIPE_SECRET_KEY`
4. Dashboard → Products → Add Product
   - Name: "SaaS Leak Audit"
   - Price: $497 one-time
   - Copy Price ID → `STRIPE_PRICE_ID`
5. Dashboard → Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/payments/webhook`
   - Select events: `checkout.session.completed`
   - Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

---

## Step 3: Set Up Plaid (Bank Connection)

1. Go to [plaid.com/dashboard](https://dashboard.plaid.com)
2. Create account
3. Get started → Choose "Application"
4. Dashboard → Team Settings → Keys
   - Client ID → `PLAID_CLIENT_ID`
   - Sandbox secret → `PLAID_SECRET`
   - Set `PLAID_ENV=sandbox` (for testing)
5. For production:
   - Submit application for approval
   - Use production secret
   - Set `PLAID_ENV=production`

---

## Step 4: Set Up Anthropic (AI Analysis)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create account
3. Get API Keys
4. Create new key → Copy → `ANTHROPIC_API_KEY`
5. Add $10 credit to account

---

## Step 5: Set Up Resend (Email)

1. Go to [resend.com](https://resend.com)
2. Create account (free: 100 emails/day)
3. Add domain OR use their test domain
4. API Keys → Create → Copy → `RESEND_API_KEY`
5. Set `FROM_EMAIL` (e.g., reports@yourdomain.com)

---

## Step 6: Deploy to Vercel

### Option A: GitHub Deploy (Recommended)

1. Create GitHub repo for your code
2. Push all files (including artifacts code)
3. Go to [vercel.com](https://vercel.com)
4. New Project → Import from GitHub
5. Select your repo
6. Framework: Next.js (auto-detected)
7. Add ALL environment variables from `.env.local`
8. Deploy
9. Copy deployment URL → Update:
   - `NEXT_PUBLIC_APP_URL` in Vercel env vars
   - Stripe webhook URL
   - Plaid redirect URI

### Option B: Local Development

```bash
# Install dependencies
npm install

# Create .env.local file with all variables

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## Step 7: Test the Flow

### Sandbox Testing:

1. Open your deployed site
2. Enter email, click "Get Report"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete payment
5. Connect bank with Plaid test credentials:
   - Username: `user_good`
   - Password: `pass_good`
6. Wait 2-3 minutes for analysis
7. Check email for report

---

## Step 8: Go Live

### Before Launch:

- [ ] Switch Plaid to production environment
- [ ] Switch Stripe to live mode
- [ ] Set up real domain
- [ ] Test end-to-end with real card
- [ ] Set up monitoring (Sentry, LogRocket)

### Launch Checklist:

- [ ] Post in r/startups about SaaS waste
- [ ] LinkedIn outreach to 50 CFOs
- [ ] ProductHunt launch (optional)
- [ ] Create demo video showing $127K found
- [ ] Set up Google Analytics

---

## Costs Breakdown

**Free tier (first 10 customers):**
- Supabase: Free
- Vercel: Free
- Plaid: Free (100 connections)
- Resend: Free (100 emails/day)
- Anthropic: ~$0.50 per audit

**At scale (100 customers/month):**
- Plaid: ~$50/month
- Anthropic: ~$50/month
- Resend: $20/month (10K emails)
- Supabase: Still free
- Vercel: Still free
- **Total: ~$120/month**
- **Revenue: $49,700/month**
- **Profit: $49,580/month (99.7% margin)**

---

## Troubleshooting

### Webhook not working:
- Check Stripe dashboard → Webhooks → View events
- Ensure webhook URL is public (not localhost)
- Check Vercel logs

### Plaid connection fails:
- Verify environment matches (sandbox vs production)
- Check redirect URI is exact match
- Ensure client ID and secret are correct

### No transactions fetched:
- Plaid sandbox has fake data
- Check dates (12 months back)
- Verify access token was stored

### Email not sending:
- Check Resend logs
- Verify FROM_EMAIL domain
- Check spam folder

---

## Next Steps After MVP

1. **Week 1-2:** Get 10 paying customers manually
2. **Week 3:** Add testimonials to landing page
3. **Week 4:** Build automated follow-up sequence
4. **Month 2:** Add "commission model" pricing option
5. **Month 3:** Partner with accounting firms to resell

---

## Support

- Plaid docs: https://plaid.com/docs/
- Stripe docs: https://stripe.com/docs
- Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs

**You now have everything to launch LeakDetector in 48 hours.**
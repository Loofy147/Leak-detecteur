// pages/api/plaid/create-link-token.js
import { Products, CountryCode } from 'plaid';
import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';
import { withSecurity } from '../../../lib/security/middleware';

async function handler(req, res) {
  const { auditId } = req.body;

  if (!auditId) {
    return res.status(400).json({ error: 'Audit ID required' });
  }

  // Verify audit exists and payment was received
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single();

  if (auditError || !audit) {
    return res.status(404).json({ error: 'Audit not found' });
  }

  if (audit.status !== 'payment_received') {
    return res.status(400).json({ error: 'Invalid audit status' });
  }

  // Create Plaid Link token
  const linkTokenResponse = await plaidClient.linkTokenCreate({
    user: { client_user_id: auditId },
    client_name: 'LeakDetector',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/connect-success`,
  });

  res.status(200).json({ link_token: linkTokenResponse.data.link_token });
}

export default withSecurity(handler, { rateLimitAction: 'plaid_link' });

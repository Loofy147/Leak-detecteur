// pages/api/plaid/create-link-token.js
// Creates a Plaid Link token for the user to connect their bank

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
}

// ---

// pages/api/plaid/exchange-token.js
// Exchanges public token for access token after user connects bank

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { public_token, auditId } = req.body;

    if (!public_token || !auditId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Store access token in database
    const { error: updateError } = await supabase
      .from('audits')
      .update({
        plaid_access_token: accessToken,
        plaid_item_id: itemId,
        status: 'bank_connected',
      })
      .eq('id', auditId);

    if (updateError) {
      throw updateError;
    }

    // Trigger transaction fetch (async)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/fetch-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId }),
    }).catch(err => console.error('Failed to trigger transaction fetch:', err));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
}
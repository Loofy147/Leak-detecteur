// pages/api/plaid/exchange-token.js
// Exchanges public token for access token after user connects bank

import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';

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

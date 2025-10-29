// pages/api/analyze/fetch-transactions.js
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { createClient } = require('@supabase/supabase-js');

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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auditId } = req.body;

    // Get audit with access token
    const { data: audit } = await supabase
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (!audit?.plaid_access_token) {
      return res.status(400).json({ error: 'No access token found' });
    }

    // Update status
    await supabase
      .from('audits')
      .update({ status: 'analyzing' })
      .eq('id', auditId);

    // Fetch 12 months of transactions
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: audit.plaid_access_token,
      start_date: startDate,
      end_date: endDate,
    });

    const transactions = transactionsResponse.data.transactions;

    // Store transactions in database
    const txInserts = transactions.map(tx => ({
      audit_id: auditId,
      transaction_id: tx.transaction_id,
      date: tx.date,
      amount: Math.abs(tx.amount), // Plaid returns negative for expenses
      merchant_name: tx.merchant_name || tx.name || 'Unknown',
      category: tx.category || [],
    }));

    if (txInserts.length > 0) {
      await supabase.from('transactions').insert(txInserts);
    }

    // Trigger leak detection
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/detect-leaks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId }),
    }).catch(err => console.error('Failed to trigger leak detection:', err));

    res.status(200).json({ success: true, transactionCount: transactions.length });
  } catch (error) {
    console.error('Error fetching transactions:', error);

    await supabase
      .from('audits')
      .update({ status: 'failed', metadata: { error: error.message } })
      .eq('id', req.body.auditId);

    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

module.exports = handler;

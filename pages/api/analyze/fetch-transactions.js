/**
 * @fileoverview This API endpoint is responsible for fetching a user's transaction history from Plaid.
 * It is the first step in the financial leak analysis process.
 */

import Joi from 'joi';
import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';
import { withValidation } from '../../../lib/security/middleware';

const fetchTransactionsSchema = Joi.object({
  auditId: Joi.string().uuid().required(),
});

/**
 * Handles the fetching and storing of transactions for a given audit.
 *
 * This endpoint performs the following steps:
 * 1. Retrieves the Plaid access token associated with the provided `auditId`.
 * 2. Updates the audit status to 'analyzing'.
 * 3. Fetches the last 12 months of transaction data from the Plaid API.
 * 4. Formats and stores the fetched transactions in the Supabase database.
 * 5. Asynchronously triggers the `detect-leaks` endpoint to start the analysis process.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.auditId - The unique identifier for the audit session.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
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

function wrappedHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return withValidation(fetchTransactionsSchema)(handler)(req, res);
}

export default wrappedHandler;

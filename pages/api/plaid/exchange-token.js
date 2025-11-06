
/**
 * @fileoverview This API endpoint exchanges a Plaid public token for an access token.
 * This is the final step in the Plaid Link flow, securing the user's bank connection.
 */

import Joi from 'joi';
import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';
import { addEmailToQueue } from '../../../lib/emailQueue';
import { withValidation } from '../../../lib/security/middleware';

const exchangeTokenSchema = Joi.object({
  public_token: Joi.string().required(),
  auditId: Joi.string().uuid().required(),
});

/**
 * @fileoverview This API endpoint exchanges a Plaid public token for an access token.
 * This is the final step in the Plaid Link flow, securing the user's bank connection.
 */

/**
 * Handles the exchange of a Plaid public token for an access token.
 *
 * This function performs the following steps:
 * 1. Receives a `public_token` and `auditId` from the client after a successful Plaid Link connection.
 * 2. Exchanges the `public_token` for a permanent `access_token` and `item_id` using the Plaid API.
 * 3. Securely stores the `access_token` and `item_id` in the Supabase database, updating the audit status to 'bank_connected'.
 * 4. Asynchronously triggers the `fetch-transactions` endpoint to begin the process of fetching the user's transaction history.
 * 5. Returns a success response to the client.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.public_token - The temporary public token obtained from the Plaid Link flow.
 * @param {string} req.body.auditId - The unique identifier for the audit session.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { public_token, auditId } = req.body;

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Store access token and update audit status
    const { data: audit, error: updateError } = await supabase
      .from('audits')
      .update({
        plaid_access_token: accessToken,
        plaid_item_id: itemId,
        status: 'bank_connected',
      })
      .eq('id', auditId)
      .select('*, user:users(*)')
      .single();

    if (updateError) {
      throw updateError;
    }

    // Send confirmation email
    if (audit && audit.email) {
      try {
        await addEmailToQueue(
          audit.email,
          'support@leakdetector.com',
          'Bank Account Connected!',
          '<p>Your bank account has been successfully connected. We are now analyzing your transactions.</p>'
        );
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }
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

/**
 * Wraps the handler function with validation middleware.
 * This ensures that incoming requests have a valid body before the main handler logic is executed.
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 */
export default withValidation(exchangeTokenSchema)(handler);

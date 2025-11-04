/**
 * @fileoverview This API endpoint creates a Plaid Link token, which is required to initialize the Plaid Link flow on the client-side.
 * This is a crucial step for the user to connect their bank account.
 */

import { Products, CountryCode } from 'plaid';
import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';
import { withSecurity } from '../../../lib/security/middleware';

/**
 * Handles the creation of a Plaid Link token.
 *
 * This function performs the following steps:
 * 1. Validates that an `auditId` is provided in the request body.
 * 2. Verifies that the audit exists and its status is 'payment_received', ensuring that a payment has been made before proceeding.
 * 3. Creates a new Plaid Link token using the `auditId` as the `client_user_id`.
 * 4. Configures the Link token for the 'Transactions' product and sets the webhook and redirect URI.
 * 5. Returns the generated `link_token` to the client, which can then be used to initialize the Plaid Link flow.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.auditId - The unique identifier for the audit session.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auditId } = req.body;

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

export default handler;

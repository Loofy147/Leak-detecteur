/**
 * @fileoverview This API endpoint creates a Stripe Checkout session for a one-time payment.
 * It also creates a corresponding audit record in the database, which is initially marked as 'pending_payment'.
 */

import Joi from 'joi';
import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';
import { withValidation } from '../../../lib/security/middleware';
import { ErrorHandler } from '../../../lib/errors/errorHandler';
import CircuitBreaker from '../../../lib/errors/circuitBreaker';

const checkoutSchema = Joi.object({
  email: Joi.string().email().required(),
  companyName: Joi.string().optional(),
});

const stripeCircuit = new CircuitBreaker(stripe.checkout.sessions.create);

/**
 * Handles the creation of a Stripe Checkout session.
 *
 * This function performs the following actions:
 * 1. Validates that the request includes an email address.
 * 2. Creates a new audit record in the Supabase database with a status of 'pending_payment'.
 * 3. Creates a Stripe Checkout session for a one-time payment, associating it with the newly created audit.
 * 4. Sets the success and cancel URLs for the checkout flow, passing the `audit_id` as a query parameter in the success URL.
 * 5. Returns the Stripe session ID and the audit ID to the client.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.email - The customer's email address.
 * @param {string} [req.body.companyName] - The customer's company name (optional).
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, companyName } = req.body;

    // Create audit record (pending payment)
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .insert({
        email,
        company_name: companyName || null,
        status: 'pending_payment',
        stripe_payment_id: 'pending', // Will update on webhook
      })
      .select()
      .single();

    if (auditError) {
      throw auditError;
    }

    // Create Stripe checkout session
    const session = await stripeCircuit.execute(() =>
      stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID, // $497 one-time price ID
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: email,
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?audit_id=${audit.id}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
        metadata: {
          audit_id: audit.id,
        },
      })
    );

    res.status(200).json({ sessionId: session.id, auditId: audit.id });
  } catch (error) {
    await ErrorHandler.handle(error, { email });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

/**
 * Wraps the handler function with validation middleware.
 * This ensures that incoming requests have a valid body before the main handler logic is executed.
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 */
export default withValidation(checkoutSchema)(handler);

/**
 * @fileoverview This API endpoint handles webhook events from Stripe.
 * It is specifically designed to process the `checkout.session.completed` event to confirm successful payments.
 */

import { buffer } from 'micro';
import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';
import { generateWelcomeEmailHtml } from '../../../lib/templates/welcome_email_template';
import { withSecurity } from '../../../lib/security/middleware';

export const config = {
  api: {
    bodyParser: false, // Need raw body for webhook verification
  },
};

/**
 * Handles incoming Stripe webhook events.
 *
 * This function performs the following actions:
 * 1. Disables the default body parser to receive the raw request body for signature verification.
 * 2. Verifies the authenticity of the webhook event using the Stripe signature.
 * 3. Listens for the `checkout.session.completed` event, which indicates a successful payment.
 * 4. Upon receiving this event, it extracts the `audit_id` from the session metadata.
 * 5. Updates the corresponding audit record in the Supabase database to 'payment_received' and stores the payment intent ID.
 * 6. Responds to Stripe with a success status to acknowledge receipt of the event.
 *
 * @param {import('micro').NextApiRequest} req - The Next.js API request object.
 * @param {import('http').ServerResponse} res - The Node.js HTTP server response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const auditId = session.metadata.audit_id;
    const userEmail = session.customer_email;

    // Update audit with payment info
    const { error: updateError } = await supabase
      .from('audits')
      .update({
        stripe_payment_id: session.payment_intent,
        status: 'payment_received',
      })
      .eq('id', auditId);

    if (updateError) {
      console.error('Failed to update audit:', updateError);
    }

    // Send welcome email with Plaid link
    try {
      const welcomeHtml = generateWelcomeEmailHtml(
        auditId,
        process.env.NEXT_PUBLIC_APP_URL
      );

      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: userEmail,
        subject: 'Welcome to LeakDetector - Next Steps',
        html: welcomeHtml,
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
  }

  res.status(200).json({ received: true });
}

export default withSecurity(handler, { rateLimitAction: null });

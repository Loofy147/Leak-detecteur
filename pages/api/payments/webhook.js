// pages/api/payments/webhook.js
// Handles Stripe webhook events (payment success)

import { buffer } from 'micro';
import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';

export const config = {
  api: {
    bodyParser: false, // Need raw body for webhook verification
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

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
      // TODO: Implement email sending
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// pages/api/payments/create-checkout.js
// Creates Stripe checkout session for $497 one-time payment

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, companyName } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

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
    const session = await stripe.checkout.sessions.create({
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
    });

    res.status(200).json({ sessionId: session.id, auditId: audit.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

// ---

// pages/api/payments/webhook.js
// Handles Stripe webhook events (payment success)

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
// pages/api/payments/create-checkout.js
// Creates Stripe checkout session for $497 one-time payment

import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';
import { withSecurity } from '../../../lib/security/middleware';
import { stripeCircuit } from '../../../lib/errors/circuitBreaker';
import { ErrorHandler } from '../../../lib/errors/errorHandler';

async function handler(req, res) {
  const { email, companyName } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
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

export default withSecurity(handler, { rateLimitAction: 'checkout' });

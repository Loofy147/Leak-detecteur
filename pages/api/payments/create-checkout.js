// pages/api/payments/create-checkout.js
// Creates Stripe checkout session for $497 one-time payment

import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';

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

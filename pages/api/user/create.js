
import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';
import { withValidation } from '../../../lib/security/middleware';
import Joi from 'joi';

const schema = Joi.object({
  email: Joi.string().email().required(),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  // Create user in Supabase
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert([{ email }])
    .select()
    .single();

  if (userError) {
    console.error('Error creating user:', userError);
    return res.status(500).json({ error: 'Failed to create user' });
  }

  // Create a new audit for the user
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .insert([{ user_id: user.id, status: 'awaiting_payment' }])
    .select()
    .single();

  if (auditError) {
    console.error('Error creating audit:', auditError);
    // TODO: Handle user cleanup if audit creation fails
    return res.status(500).json({ error: 'Failed to create audit' });
  }

  // Generate a payment link (example, replace with your payment provider)
  const paymentLink = `${process.env.NEXT_PUBLIC_APP_URL}/pay?auditId=${audit.id}`;

  // Send welcome email with payment link
  try {
    await resend.emails.send({
      from: 'onboarding@leakdetector.com',
      to: email,
      subject: 'Welcome to LeakDetector!',
      html: `<p>Welcome to LeakDetector! Please <a href="${paymentLink}">click here to complete payment</a> and start your audit.</p>`,
    });
  } catch (emailError) {
    console.error('Error sending welcome email:', emailError);
    // Note: The user and audit have been created, so we don't want to fail the request here.
    // We should have a separate process for handling failed emails.
  }

  res.status(201).json({ userId: user.id, auditId: audit.id });
}

export default withValidation(schema)(handler);


/**
 * @fileoverview API endpoint for creating a new user and a corresponding audit.
 * This is the first step in the user onboarding process.
 */
import supabase from '../../../lib/services/supabase';
import { addEmailToQueue } from '../../../lib/emailQueue';
import { withValidation } from '../../../lib/security/middleware';
import Joi from 'joi';

const schema = Joi.object({
  email: Joi.string().email().required(),
});

/**
 * Handles the creation of a new user and an associated audit.
 *
 * This function performs the following steps:
 * 1. Creates a new user in the Supabase `users` table with the provided email.
 * 2. Creates a new audit in the `audits` table, linking it to the newly created user.
 * 3. Sends a welcome email to the user with a payment link to begin the audit process.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.email - The email address of the new user.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
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
    await addEmailToQueue(
      email,
      'onboarding@leakdetector.com',
      'Welcome to LeakDetector!',
      `<p>Welcome to LeakDetector! Please <a href="${paymentLink}">click here to complete payment</a> and start your audit.</p>`
    );
  } catch (emailError) {
    console.error('Error sending welcome email:', emailError);
    // Note: The user and audit have been created, so we don't want to fail the request here.
    // We should have a separate process for handling failed emails.
  }

  res.status(201).json({ userId: user.id, auditId: audit.id });
}

/**
 * Wraps the handler function with validation middleware.
 * This ensures that incoming requests have a valid body before the main handler logic is executed.
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 */
export default withValidation(schema)(handler);

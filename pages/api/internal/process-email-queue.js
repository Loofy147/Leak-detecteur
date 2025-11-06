// pages/api/internal/process-email-queue.js
import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';

/**
 * Processes the email queue, sending pending emails.
 *
 * This endpoint should be called by a scheduled job (e.g., a cron job).
 * It fetches pending emails from the `email_queue` table, attempts to send
 * them using the `resend` service, and updates their status in the database.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { authorization } = req.headers;

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: pendingEmails, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(10); // Process 10 emails at a time to avoid timeouts

  if (error) {
    console.error('Error fetching pending emails:', error);
    return res.status(500).json({ error: 'Failed to fetch pending emails' });
  }

  for (const email of pendingEmails) {
    try {
      await resend.emails.send({
        from: email.from_email,
        to: email.to_email,
        subject: email.subject,
        html: email.html,
      });

      await supabase
        .from('email_queue')
        .update({ status: 'sent', last_attempt_at: new Date().toISOString() })
        .eq('id', email.id);
    } catch (sendError) {
      console.error('Error sending email:', sendError);
      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          last_attempt_at: new Date().toISOString(),
          error_message: sendError.message,
          attempts: email.attempts + 1,
        })
        .eq('id', email.id);
    }
  }

  res.status(200).json({ success: true, processed: pendingEmails.length });
}

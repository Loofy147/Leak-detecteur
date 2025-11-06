// lib/emailQueue.js
import supabase from './services/supabase';

/**
 * Adds an email to the email queue for later processing.
 * @param {string} to - The recipient's email address.
 * @param {string} from - The sender's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} html - The HTML content of the email.
 * @returns {Promise<void>}
 */
export async function addEmailToQueue(to, from, subject, html) {
  const { error } = await supabase.from('email_queue').insert({
    to_email: to,
    from_email: from,
    subject,
    html,
  });

  if (error) {
    console.error('Error adding email to queue:', error);
    // Depending on the desired level of robustness, you might want to
    // implement a fallback or retry mechanism here. For now, we'll just log
    // the error.
  }
}

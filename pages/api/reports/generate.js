/**
 * @fileoverview This API endpoint generates and emails a financial leak report to the user.
 * It is the final step in the audit process.
 */

import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';
import { generateReportHtml } from '../../../lib/templates/report_template';
import { withSecurity } from '../../../lib/security/middleware';

/**
 * Handles the generation and emailing of the financial leak report.
 *
 * This function performs the following steps:
 * 1. Retrieves the audit data and all associated leaks from the database using the `auditId`.
 * 2. Generates an HTML report using a template function.
 * 3. Emails the HTML report to the user's email address on file.
 * 4. Updates the audit record to indicate that the report has been sent.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.auditId - The unique identifier for the audit session.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auditId } = req.body;

    // Get audit and user info
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*, user:users(email)')
      .eq('id', auditId)
      .single();

    if (auditError || !audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    // Get all leaks
    const { data: leaks } = await supabase
      .from('leaks')
      .select('*')
      .eq('audit_id', auditId)
      .order('annual_cost', { ascending: false });

    // Generate HTML report (you could convert this to PDF with puppeteer)
    const reportHtml = generateReportHtml(audit, leaks || []);

    // For MVP, just email HTML report
    // In production, use puppeteer to generate PDF
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: audit.email,
      subject: `💰 Your SaaS Leak Report: $${audit.total_waste_found?.toLocaleString() || '0'} Found`,
      html: reportHtml,
    });

    // Update audit with report sent status
    await supabase
      .from('audits')
      .update({
        report_url: 'email_sent',
        metadata: { report_sent_at: new Date().toISOString() },
      })
      .eq('id', auditId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}

export default handler;

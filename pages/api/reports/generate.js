// pages/api/reports/generate.js
// Generates PDF report and emails to customer

import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';
import { generateReportHtml } from '../../../lib/templates/report_template';
import { withSecurity } from '../../../lib/security/middleware';

async function handler(req, res) {
  const { auditId } = req.body;

  // Get audit data
  const { data: audit } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single();

  if (!audit) {
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
}

export default withSecurity(handler);

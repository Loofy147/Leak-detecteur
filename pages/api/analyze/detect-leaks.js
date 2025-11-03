// pages/api/analyze/detect-leaks.js
import supabase from '../../../lib/services/supabase';
import { detectRecurringCharges } from '../../../lib/recurring_charges';
import { analyzeWithAI } from '../../../lib/ai_analyzer';
import { withSecurity } from '../../../lib/security/middleware';

async function handler(req, res) {
  const { auditId } = req.body;

  // Get all transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('audit_id', auditId)
    .order('date', { ascending: true });

  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions found');
  }

  // 1. DETECT RECURRING CHARGES
  const recurringCharges = detectRecurringCharges(transactions);

  // 2. USE AI TO CATEGORIZE AND FIND WASTE
  const leaks = await analyzeWithAI(recurringCharges, auditId);

  // 3. STORE LEAKS
  if (leaks.length > 0) {
    await supabase.from('leaks').insert(leaks);
  }

  // 4. CALCULATE TOTAL WASTE
  const totalWaste = leaks.reduce((sum, leak) => sum + parseFloat(leak.annual_cost), 0);

  // 5. UPDATE AUDIT STATUS
  await supabase
    .from('audits')
    .update({
      status: 'completed',
      total_waste_found: totalWaste,
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId);

  // 6. TRIGGER REPORT GENERATION
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auditId }),
  }).catch(err => console.error('Failed to trigger report generation:', err));

  res.status(200).json({ success: true, leaksFound: leaks.length, totalWaste });
}

export default withSecurity(handler);

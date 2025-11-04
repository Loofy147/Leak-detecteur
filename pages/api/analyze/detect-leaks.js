/**
 * @fileoverview This API endpoint orchestrates the process of detecting financial leaks from a user's transactions.
 * It is triggered after all transactions for an audit have been fetched and stored.
 */

import Joi from 'joi';
import supabase from '../../../lib/services/supabase.js';
import { detectRecurringCharges } from '../../../lib/recurring_charges.js';
import { analyzeWithAI } from '../../../lib/ai_analyzer.js';
import { withValidation } from '../../../lib/security/middleware.js';

const detectLeaksSchema = Joi.object({
  auditId: Joi.string().uuid().required(),
});

/**
 * Handles the financial leak detection process.
 *
 * This endpoint performs the following steps:
 * 1. Fetches all transactions associated with a given `auditId`.
 * 2. Identifies recurring charges from the transactions.
 * 3. Uses an AI model to analyze the recurring charges for potential waste (leaks).
 * 4. Stores any identified leaks in the database.
 * 5. Calculates the total estimated annual waste from the leaks.
 * 6. Updates the audit record with the results and marks it as 'completed'.
 * 7. Triggers the report generation process asynchronously.
 *
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {object} req.body - The request body.
 * @param {string} req.body.auditId - The unique identifier for the audit to be processed.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {Promise<void>} A promise that resolves when the response has been sent.
 */
async function handler(req, res) {
  try {
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
  } catch (error) {
    console.error('Error detecting leaks:', error);
    res.status(500).json({ error: 'Failed to detect leaks' });
  }

}

/**
 * Wraps the handler function with validation middleware and a method check.
 * This ensures that incoming requests have a valid body and are of the correct HTTP method
 * before the main handler logic is executed.
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 */
function wrappedHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return withValidation(detectLeaksSchema)(handler)(req, res);
}

export default wrappedHandler;

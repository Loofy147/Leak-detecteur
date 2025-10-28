// pages/api/analyze/fetch-transactions.js
// Fetches transactions from Plaid and stores in database

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auditId } = req.body;

    // Get audit with access token
    const { data: audit } = await supabase
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (!audit?.plaid_access_token) {
      return res.status(400).json({ error: 'No access token found' });
    }

    // Update status
    await supabase
      .from('audits')
      .update({ status: 'analyzing' })
      .eq('id', auditId);

    // Fetch 12 months of transactions
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: audit.plaid_access_token,
      start_date: startDate,
      end_date: endDate,
    });

    const transactions = transactionsResponse.data.transactions;

    // Store transactions in database
    const txInserts = transactions.map(tx => ({
      audit_id: auditId,
      transaction_id: tx.transaction_id,
      date: tx.date,
      amount: Math.abs(tx.amount), // Plaid returns negative for expenses
      merchant_name: tx.merchant_name || tx.name || 'Unknown',
      category: tx.category || [],
    }));

    if (txInserts.length > 0) {
      await supabase.from('transactions').insert(txInserts);
    }

    // Trigger leak detection
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/detect-leaks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId }),
    }).catch(err => console.error('Failed to trigger leak detection:', err));

    res.status(200).json({ success: true, transactionCount: transactions.length });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    
    await supabase
      .from('audits')
      .update({ status: 'failed', metadata: { error: error.message } })
      .eq('id', req.body.auditId);

    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

// ---

// pages/api/analyze/detect-leaks.js
// Analyzes transactions to detect SaaS waste patterns

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

// Helper: Detect recurring charges by merchant name pattern matching
function detectRecurringCharges(transactions) {
  const merchantGroups = {};

  // Group transactions by merchant
  transactions.forEach(tx => {
    const merchant = tx.merchant_name.toLowerCase().trim();
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = [];
    }
    merchantGroups[merchant].push(tx);
  });

  const recurring = [];

  // Find merchants with 3+ charges in consistent intervals
  Object.entries(merchantGroups).forEach(([merchant, txs]) => {
    if (txs.length >= 3) {
      // Sort by date
      txs.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate average interval in days
      const intervals = [];
      for (let i = 1; i < txs.length; i++) {
        const days = Math.floor(
          (new Date(txs[i].date) - new Date(txs[i - 1].date)) / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // If ~monthly (25-35 days) or ~annual (350-380 days)
      if ((avgInterval >= 25 && avgInterval <= 35) || (avgInterval >= 350 && avgInterval <= 380)) {
        const frequency = avgInterval < 50 ? 'monthly' : 'annual';
        const avgAmount = txs.reduce((sum, t) => sum + parseFloat(t.amount), 0) / txs.length;

        recurring.push({
          merchant,
          transactions: txs,
          frequency,
          avgAmount: avgAmount.toFixed(2),
          lastCharge: txs[txs.length - 1].date,
          chargeCount: txs.length,
        });
      }
    }
  });

  return recurring;
}

// Helper: Use Claude AI to analyze recurring charges and identify waste
async function analyzeWithAI(recurringCharges, auditId) {
  const prompt = `You are analyzing recurring SaaS subscriptions for waste. Here are the recurring charges found:

${JSON.stringify(recurringCharges, null, 2)}

For each charge, determine:
1. Is it likely a SaaS subscription?
2. What type of leak is it? (zombie, duplicate, free_alternative, or none if legitimate)
3. Monthly cost estimate
4. Description of the waste
5. Recommendation for what to do

Return ONLY a JSON array of leaks in this exact format:
[
  {
    "merchant_name": "exact merchant name",
    "leak_type": "zombie|duplicate|free_alternative|none",
    "monthly_cost": 99.00,
    "annual_cost": 1188.00,
    "description": "Brief description of the issue",
    "recommendation": "Specific action to take",
    "confidence_score": 0.85
  }
]

Only include items where leak_type is NOT "none". Be conservative - only flag clear waste.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('No JSON array found in AI response');
      return [];
    }

    const aiLeaks = JSON.parse(jsonMatch[0]);

    // Format for database
    return aiLeaks.map(leak => ({
      audit_id: auditId,
      leak_type: leak.leak_type,
      merchant_name: leak.merchant_name,
      monthly_cost: leak.monthly_cost,
      annual_cost: leak.annual_cost,
      description: leak.description,
      recommendation: leak.recommendation,
      confidence_score: leak.confidence_score,
      evidence: { ai_analysis: true },
    }));
  } catch (error) {
    console.error('AI analysis error:', error);
    return [];
  }
}
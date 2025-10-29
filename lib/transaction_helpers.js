// lib/transaction_helpers.js
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

      const MIN_MONTHLY_INTERVAL = 25;
      const MAX_MONTHLY_INTERVAL = 35;
      const MIN_ANNUAL_INTERVAL = 350;
      const MAX_ANNUAL_INTERVAL = 380;
      const MONTHLY_ANNUAL_THRESHOLD = 50;

      // If ~monthly (25-35 days) or ~annual (350-380 days)
      if ((avgInterval >= MIN_MONTHLY_INTERVAL && avgInterval <= MAX_MONTHLY_INTERVAL) || (avgInterval >= MIN_ANNUAL_INTERVAL && avgInterval <= MAX_ANNUAL_INTERVAL)) {
        const frequency = avgInterval < MONTHLY_ANNUAL_THRESHOLD ? 'monthly' : 'annual';
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

  const AI_MODEL = 'claude-sonnet-4-20250514';

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
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

module.exports = {
  detectRecurringCharges,
  analyzeWithAI,
};

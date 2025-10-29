// lib/ai_analyzer.js
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Helper: Use Claude AI to analyze recurring charges and identify waste
export async function analyzeWithAI(recurringCharges, auditId) {
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

/**
 * @fileoverview This module provides an interface to an AI model for analyzing recurring charges.
 * It uses the Anthropic API to identify potential financial leaks from a list of recurring transactions.
 */

import Anthropic from '@anthropic-ai/sdk';
import CircuitBreaker from './errors/circuitBreaker.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const anthropicApiCall = async (prompt) => {
  const AI_MODEL = 'claude-sonnet-4-20250514';
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response;
};

const circuitBreaker = new CircuitBreaker(anthropicApiCall);

/**
 * Analyzes a list of recurring charges using an AI model to identify potential financial waste.
 *
 * This function sends the list of recurring charges to the Anthropic AI model with a prompt
 * that asks it to identify SaaS subscriptions and classify them as potential leaks (e.g., zombie,
 * duplicate, or having a free alternative). The AI's response is then parsed and formatted
 * for database insertion. The call to the Anthropic API is wrapped in a circuit breaker to
 * provide resilience against API failures.
 *
 * @param {Array<Object>} recurringCharges - An array of recurring charge objects, as detected by `detectRecurringCharges`.
 * @param {string} recurringCharges[].merchant - The name of the merchant.
 * @param {string} recurringCharges[].frequency - The frequency of the charge (e.g., 'monthly').
 * @param {number} recurringCharges[].avgAmount - The average amount of the charge.
 * @param {string} auditId - The unique identifier for the audit session.
 *
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of leak objects, formatted for the database.
 *   Each object represents a potential financial leak identified by the AI. If the AI analysis fails or no leaks
 *   are found, the promise resolves to an empty array.
 */
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

  try {
    const response = await circuitBreaker.fire(prompt);

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

// lib/errors/fallbacks.js
// Fallback strategies when primary methods fail

/**
 * Provides fallback strategies for core application functionalities, ensuring
 * resilience when primary methods (like AI analysis or Plaid integration) fail.
 */
export class FallbackStrategies {
  /**
   * A rule-based leak detection mechanism that serves as a fallback when the
   * primary AI-based analysis is unavailable. It identifies common types of
   * subscription waste, such as payments for free software, zombie subscriptions,
   * and unusually high-cost services.
   * @param {Array<Object>} recurringCharges - An array of recurring charge objects.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of identified leaks.
   */
  static async fallbackLeakDetection(recurringCharges) {
    const leaks = [];

    recurringCharges.forEach(charge => {
      const merchant = charge.merchant.toLowerCase();

      // Rule 1: Detect common free software being paid for
      const freeTools = ['vscode', 'winzip', 'winrar', 'vlc', '7-zip'];
      if (freeTools.some(tool => merchant.includes(tool))) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'free_alternative',
          monthly_cost: charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12,
          annual_cost: charge.frequency === 'annual' ? charge.avgAmount : charge.avgAmount * 12,
          description: 'Paying for software that has a free alternative',
          recommendation: 'Cancel subscription and use free version',
          confidence_score: 0.95,
        });
      }

      // Rule 2: Detect zombie subscriptions (no charges in last 90 days)
      const daysSinceLastCharge = Math.floor(
        (Date.now() - new Date(charge.lastCharge).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastCharge > 90) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'zombie',
          monthly_cost: charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12,
          annual_cost: charge.frequency === 'annual' ? charge.avgAmount : charge.avgAmount * 12,
          description: `No charges in last ${daysSinceLastCharge} days - likely unused`,
          recommendation: 'Review usage and consider canceling',
          confidence_score: 0.75,
        });
      }

      // Rule 3: High-cost subscriptions (>$100/month)
      const monthlyCost = charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12;
      if (monthlyCost > 100) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'unused',
          monthly_cost: monthlyCost,
          annual_cost: monthlyCost * 12,
          description: `High-cost subscription ($${monthlyCost.toFixed(2)}/month) - verify active usage`,
          recommendation: 'Review team usage and consider downgrading if underutilized',
          confidence_score: 0.60,
        });
      }
    });

    return leaks;
  }

  /**
   * A fallback for when Plaid integration fails, allowing users to upload their
   * transaction data manually via a CSV file. This method parses the CSV data
   * and transforms it into the standard transaction format used by the application.
   * @param {string} csvData - A string containing the transaction data in CSV format.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transaction objects.
   */
  static async manualTransactionUpload(csvData) {
    // Parse CSV and return transactions
    // This is a simplified version - production would use Papa Parse
    const lines = csvData.split('\n');
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const [date, description, amount] = lines[i].split(',');
      if (date && description && amount) {
        transactions.push({
          date: date.trim(),
          merchant_name: description.trim(),
          amount: parseFloat(amount.trim()),
          category: [],
        });
      }
    }

    return transactions;
  }
}

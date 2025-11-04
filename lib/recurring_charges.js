/**
 * @fileoverview This module contains functions for detecting recurring charges from a list of transactions.
 * It identifies recurring payments based on consistent merchant names and time intervals.
 */

/**
 * Detects recurring charges from a list of transactions.
 *
 * This function groups transactions by merchant and analyzes the intervals between them to identify
 * weekly, bi-weekly, monthly, quarterly, and annual recurring charges. A minimum of three transactions
 * with a consistent interval is required to identify a recurring charge.
 *
 * @param {Array<Object>} transactions - An array of transaction objects.
 * @param {string} transactions[].merchant_name - The name of the merchant for the transaction.
 * @param {string} transactions[].date - The date of the transaction in a format parseable by `new Date()`.
 * @param {number} transactions[].amount - The amount of the transaction.
 *
 * @returns {Array<Object>} An array of objects, each representing a detected recurring charge.
 *   Each object includes the merchant name, a list of associated transactions, the detected frequency
 *   (weekly, bi-weekly, monthly, quarterly, annual), the average charge amount, the date of the last charge,
 *   and the total count of charges. Returns an empty array if no recurring charges are found.
 */
export function detectRecurringCharges(transactions) {
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

      const INTERVALS = {
        weekly: { min: 6, max: 9 },
        'bi-weekly': { min: 13, max: 16 },
        monthly: { min: 28, max: 32 },
        quarterly: { min: 88, max: 92 },
        annual: { min: 363, max: 367 },
      };

      let frequency = null;
      for (const [freq, range] of Object.entries(INTERVALS)) {
        if (avgInterval >= range.min && avgInterval <= range.max) {
          frequency = freq;
          break;
        }
      }

      if (frequency) {
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

// lib/recurring_charges.js

// Helper: Detect recurring charges by merchant name pattern matching
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

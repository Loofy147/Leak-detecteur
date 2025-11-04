// lib/optimization/apiOptimizer.js
// Optimize external API calls
import { cache } from './cache';
import plaidClient from '../services/plaid';
import anthropic from '../services/anthropic';


export class APIOptimizer {
  // Batch Plaid transaction fetches
  static async fetchTransactionsOptimized(accessToken, startDate, endDate) {
    const cacheKey = `plaid_tx_${accessToken}_${startDate}_${endDate}`;

    return cache.getOrSet(cacheKey, async () => {
      // Fetch with pagination to handle large datasets
      let allTransactions = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            offset,
            count: 500, // Max per request
          },
        });

        allTransactions = allTransactions.concat(response.data.transactions);
        hasMore = response.data.transactions.length === 500;
        offset += 500;
      }

      return allTransactions;
    }, 3600); // Cache for 1 hour
  }

  // Optimize Anthropic API calls with prompt caching
  static async analyzeWithCache(prompt, cacheKey) {
    return cache.getOrSet(
      `anthropic_${cacheKey}`,
      async () => {
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        });
      },
      7200 // Cache for 2 hours
    );
  }
}

// ---

// Performance monitoring
export class PerformanceMonitor {
  static async measureAsync(name, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;

      // await metrics.track('performance', {
      //   operation: name,
      //   duration,
      //   success: true,
      // });

      if (duration > 5000) {
        // Logger.warn(`Slow operation: ${name} took ${duration.toFixed(0)}ms`);
        console.warn(`Slow operation: ${name} took ${duration.toFixed(0)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      // await metrics.track('performance', {
      //   operation: name,
      //   duration,
      //   success: false,
      // });

      throw error;
    }
  }
}

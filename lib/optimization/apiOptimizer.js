// lib/optimization/apiOptimizer.js
// Optimize external API calls
import { cache } from './cache';
import plaidClient from '../services/plaid';
import anthropic from '../services/anthropic';

/**
 * Optimizes external API calls through caching and efficient data fetching strategies.
 */
export class APIOptimizer {
  /**
   * Fetches Plaid transactions with caching and pagination to handle large datasets efficiently.
   * @param {string} accessToken - The Plaid access token.
   * @param {string} startDate - The start date for fetching transactions (YYYY-MM-DD).
   * @param {string} endDate - The end date for fetching transactions (YYYY-MM-DD).
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of transactions.
   */
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

  /**
   * Caches responses from the Anthropic API to avoid redundant calls with the same prompt.
   * @param {string} prompt - The prompt to send to the Anthropic API.
   * @param {string} cacheKey - A unique key to identify the request for caching purposes.
   * @returns {Promise<Object>} A promise that resolves to the response from the Anthropic API.
   */
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

/**
 * Monitors and logs the performance of asynchronous operations.
 */
export class PerformanceMonitor {
  /**
   * Measures the execution time of an asynchronous function and logs a warning if it exceeds a threshold.
   * @param {string} name - The name of the operation being measured.
   * @param {Function} fn - The asynchronous function to execute and measure.
   * @returns {Promise<*>} A promise that resolves with the result of the function.
   * @throws {Error} Throws an error if the executed function throws an error.
   */
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

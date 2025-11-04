// lib/optimization/queryOptimizer.js
// Optimize database queries
import { cache } from './cache';
import supabase from '../services/supabase';


/**
 * Optimizes database queries through techniques like caching, parallel execution, and pagination.
 */
export class QueryOptimizer {
  /**
   * Retrieves an audit summary using a cached database view for complex, multi-table queries.
   * This approach avoids redundant, expensive queries by caching the results of a pre-computed view.
   * @param {string} auditId - The unique identifier for the audit.
   * @returns {Promise<Object>} A promise that resolves to the audit summary data.
   */
  static async getAuditSummary(auditId) {
    // Instead of multiple queries, use a materialized view
    return cache.getOrSet(
      `audit_summary_${auditId}`,
      async () => {
        const { data } = await supabase
          .rpc('get_audit_summary', { audit_id: auditId });
        return data;
      },
      60 // Cache for 1 minute
    );
  }

  /**
   * Fetches the full details of an audit by executing multiple queries in parallel.
   * This reduces the total wait time by running independent queries concurrently rather than sequentially.
   * @param {string} auditId - The unique identifier for the audit.
   * @returns {Promise<Object>} A promise that resolves to an object containing the audit, leaks, and transactions data.
   */
  static async getAuditDetails(auditId) {
    const [audit, leaks, transactions] = await Promise.all([
      supabase.from('audits').select('*').eq('id', auditId).single(),
      supabase.from('leaks').select('*').eq('audit_id', auditId),
      supabase.from('transactions').select('*').eq('audit_id', auditId).limit(100),
    ]);

    return {
      audit: audit.data,
      leaks: leaks.data,
      transactions: transactions.data,
    };
  }

  /**
   * Implements pagination for fetching large sets of transaction data.
   * This avoids overwhelming the client and database by retrieving data in smaller, manageable chunks.
   * @param {string} auditId - The unique identifier for the audit.
   * @param {number} [page=1] - The page number to retrieve.
   * @param {number} [pageSize=50] - The number of items per page.
   * @returns {Promise<Object>} A promise that resolves to an object containing the paginated data and metadata.
   */
  static async getPaginatedTransactions(auditId, page = 1, pageSize = 50) {
    const start = (page - 1) * pageSize;

    const { data, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('audit_id', auditId)
      .order('date', { ascending: false })
      .range(start, start + pageSize - 1);

    return {
      data,
      page,
      pageSize,
      totalCount: count,
      totalPages: Math.ceil(count / pageSize),
    };
  }
}

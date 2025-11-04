// lib/optimization/queryOptimizer.js
// Optimize database queries
import { cache } from './cache';
import supabase from '../services/supabase';


export class QueryOptimizer {
  // Use database views for complex queries
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

  // Parallel query execution
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

  // Pagination for large result sets
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

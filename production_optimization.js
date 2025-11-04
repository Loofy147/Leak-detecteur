// lib/optimization/cache.js
// In-memory caching layer for frequently accessed data

class Cache {
  constructor() {
    this.store = new Map();
    this.ttl = new Map(); // Time to live
  }

  set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    this.ttl.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(key) {
    if (!this.store.has(key)) return null;

    const expiry = this.ttl.get(key);
    if (Date.now() > expiry) {
      this.store.delete(key);
      this.ttl.delete(key);
      return null;
    }

    return this.store.get(key);
  }

  delete(key) {
    this.store.delete(key);
    this.ttl.delete(key);
  }

  clear() {
    this.store.clear();
    this.ttl.clear();
  }

  // Get or compute value
  async getOrSet(key, fn, ttlSeconds = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const cache = new Cache();

// ---

// lib/optimization/batchProcessor.js
// Batch API calls to reduce overhead

export class BatchProcessor {
  constructor(options = {}) {
    this.maxBatchSize = options.maxBatchSize || 100;
    this.maxWaitTime = options.maxWaitTime || 50; // ms
    this.queue = [];
    this.timer = null;
  }

  async add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWaitTime);
      }
    });
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxBatchSize);
    
    try {
      const results = await this.processBatch(batch.map(b => b.item));
      
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }

  // Override this in subclasses
  async processBatch(items) {
    throw new Error('processBatch must be implemented');
  }
}

// Example: Batch transaction insertions
export class TransactionBatchProcessor extends BatchProcessor {
  constructor(supabase) {
    super({ maxBatchSize: 1000, maxWaitTime: 100 });
    this.supabase = supabase;
  }

  async processBatch(transactions) {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert(transactions);

    if (error) throw error;
    return transactions.map((_, i) => data[i]);
  }
}

// ---

// lib/optimization/queryOptimizer.js
// Optimize database queries

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

// ---

// Database optimizations to add to Supabase:
/*
-- Create a materialized view for audit summaries (faster than joining)
CREATE MATERIALIZED VIEW audit_summaries AS
SELECT 
  a.id,
  a.email,
  a.status,
  a.total_waste_found,
  COUNT(DISTINCT l.id) as leak_count,
  COUNT(DISTINCT t.id) as transaction_count,
  MAX(l.annual_cost) as highest_leak_amount,
  a.created_at,
  a.completed_at
FROM audits a
LEFT JOIN leaks l ON l.audit_id = a.id
LEFT JOIN transactions t ON t.audit_id = a.id
GROUP BY a.id;

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION get_audit_summary(audit_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  status TEXT,
  total_waste_found DECIMAL,
  leak_count BIGINT,
  transaction_count BIGINT,
  highest_leak_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM audit_summaries WHERE id = audit_id;
END;
$$ LANGUAGE plpgsql;

-- Refresh materialized view every hour
SELECT cron.schedule(
  'refresh-audit-summaries',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW audit_summaries'
);

-- Create composite indexes for common queries
CREATE INDEX idx_audits_status_created ON audits(status, created_at DESC);
CREATE INDEX idx_leaks_audit_cost ON leaks(audit_id, annual_cost DESC);
CREATE INDEX idx_transactions_audit_date ON transactions(audit_id, date DESC);

-- Create partial index for active audits (frequently queried)
CREATE INDEX idx_audits_active ON audits(id) 
WHERE status IN ('analyzing', 'bank_connected', 'payment_received');
*/

// ---

// lib/optimization/apiOptimizer.js
// Optimize external API calls

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
      
      await metrics.track('performance', {
        operation: name,
        duration,
        success: true,
      });

      if (duration > 5000) {
        Logger.warn(`Slow operation: ${name} took ${duration.toFixed(0)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      await metrics.track('performance', {
        operation: name,
        duration,
        success: false,
      });

      throw error;
    }
  }
}
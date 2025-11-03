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

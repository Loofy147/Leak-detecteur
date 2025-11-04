// lib/optimization/batchProcessor.js
// Batch API calls to reduce overhead

/**
 * A generic class for batching operations to reduce overhead from frequent, small API calls.
 * It collects items in a queue and processes them in a single batch when the queue
 * reaches a maximum size or after a specified wait time.
 */
export class BatchProcessor {
  /**
   * Creates a new BatchProcessor instance.
   * @param {Object} [options={}] - Configuration for the batch processor.
   * @param {number} [options.maxBatchSize=100] - The maximum number of items to include in a single batch.
   * @param {number} [options.maxWaitTime=50] - The maximum time in milliseconds to wait before flushing the queue.
   */
  constructor(options = {}) {
    this.maxBatchSize = options.maxBatchSize || 100;
    this.maxWaitTime = options.maxWaitTime || 50; // ms
    this.queue = [];
    this.timer = null;
  }

  /**
   * Adds an item to the processing queue and triggers a flush if the batch size or wait time is exceeded.
   * @param {*} item - The item to add to the queue.
   * @returns {Promise<*>} A promise that resolves with the result of the batch processing for this item.
   */
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

  /**
   * Processes the current queue of items as a single batch.
   * It sends the batch to the `processBatch` method and resolves or rejects the promises
   * associated with each item based on the outcome.
   */
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

  /**
   * A placeholder method for processing a batch of items. This method must be implemented by subclasses.
   * @param {Array<*>} items - An array of items to process.
   * @returns {Promise<Array<*>>} A promise that resolves with an array of results corresponding to the input items.
   * @throws {Error} Throws an error if not implemented by a subclass.
   */
  async processBatch(items) {
    throw new Error('processBatch must be implemented');
  }
}

/**
 * An example implementation of `BatchProcessor` for inserting transactions into a Supabase database.
 */
export class TransactionBatchProcessor extends BatchProcessor {
  /**
   * Creates a new TransactionBatchProcessor instance.
   * @param {Object} supabase - The Supabase client instance.
   */
  constructor(supabase) {
    super({ maxBatchSize: 1000, maxWaitTime: 100 });
    this.supabase = supabase;
  }

  /**
   * Processes a batch of transactions by inserting them into the 'transactions' table in Supabase.
   * @param {Array<Object>} transactions - An array of transaction objects to insert.
   * @returns {Promise<Array<Object>>} A promise that resolves with the inserted data.
   * @throws {Error} Throws an error if the Supabase insertion fails.
   */
  async processBatch(transactions) {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert(transactions);

    if (error) throw error;
    return transactions.map((_, i) => data[i]);
  }
}

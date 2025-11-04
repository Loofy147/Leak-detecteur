// lib/optimization/cache.js
// In-memory caching layer for frequently accessed data

/**
 * An in-memory caching layer for storing and retrieving frequently accessed data.
 * It supports time-to-live (TTL) for automatic cache expiration.
 */
class Cache {
  /**
   * Creates a new Cache instance.
   */
  constructor() {
    this.store = new Map();
    this.ttl = new Map(); // Time to live
  }

  /**
   * Stores a value in the cache with an optional time-to-live (TTL).
   * @param {string} key - The key to associate with the value.
   * @param {*} value - The value to store.
   * @param {number} [ttlSeconds=300] - The time-to-live in seconds.
   */
  set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    this.ttl.set(key, Date.now() + ttlSeconds * 1000);
  }

  /**
   * Retrieves a value from the cache. Returns null if the key does not exist or the TTL has expired.
   * @param {string} key - The key of the value to retrieve.
   * @returns {*} The cached value or null if not found or expired.
   */
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

  /**
   * Deletes a value from the cache.
   * @param {string} key - The key of the value to delete.
   */
  delete(key) {
    this.store.delete(key);
    this.ttl.delete(key);
  }

  /**
   * Clears the entire cache, removing all stored values.
   */
  clear() {
    this.store.clear();
    this.ttl.clear();
  }

  /**
   * Retrieves a value from the cache if it exists. Otherwise, it executes the provided function
   * to compute the value, stores it in the cache, and then returns it.
   * @param {string} key - The cache key.
   * @param {Function} fn - An asynchronous function that computes the value if it's not in the cache.
   * @param {number} [ttlSeconds=300] - The TTL for the newly computed value.
   * @returns {Promise<*>} A promise that resolves with the cached or newly computed value.
   */
  async getOrSet(key, fn, ttlSeconds = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const cache = new Cache();

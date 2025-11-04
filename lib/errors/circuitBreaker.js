// lib/errors/circuitBreaker.js
// Circuit breaker pattern for external APIs

// import { Logger } from '../monitoring/logger';

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000;
    this.resetTimeout = options.resetTimeout || 60000;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;

      // Logger.error(`Circuit breaker ${this.name} opened`, null, {
      //   failureCount: this.failureCount,
      //   nextAttempt: new Date(this.nextAttempt).toISOString(),
      // });
      console.error(`Circuit breaker ${this.name} opened`, {
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      });
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}

// Create circuit breakers for external services
export const plaidCircuit = new CircuitBreaker('plaid', {
  failureThreshold: 3,
  resetTimeout: 120000, // 2 minutes
});

export const anthropicCircuit = new CircuitBreaker('anthropic', {
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
});

export const stripeCircuit = new CircuitBreaker('stripe', {
  failureThreshold: 5,
  resetTimeout: 300000, // 5 minutes
});

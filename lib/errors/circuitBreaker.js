/**
 * @fileoverview This module implements a circuit breaker pattern for handling external service calls.
 *
 * The circuit breaker prevents an application from repeatedly trying to execute an operation that is likely to fail.
 * It monitors for failures, and when the number of failures reaches a certain threshold, it "opens" the circuit,
 * preventing further calls to the service. After a timeout period, the circuit becomes "half-open," allowing a
 * single test request to pass through. If the test request succeeds, the circuit is "closed," and normal operation
 * resumes. If it fails, the circuit remains "open."
 */

/**
 * Represents the possible states of the circuit breaker.
 * @enum {string}
 */
const CircuitBreakerState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

/**
 * A circuit breaker that can be used to wrap external service calls.
 */
class CircuitBreaker {
  /**
   * Creates a new CircuitBreaker instance.
   * @param {Function} action - The function to execute when the circuit is closed.
   * @param {object} options - The configuration options for the circuit breaker.
   * @param {number} [options.failureThreshold=3] - The number of failures required to open the circuit.
   * @param {number} [options.successThreshold=1] - The number of successful executions required to close the circuit.
   * @param {number} [options.timeout=10000] - The time in milliseconds to wait before transitioning to the half-open state.
   */
  constructor(action, options = {}) {
    this.action = action;
    this.failureThreshold = options.failureThreshold || 3;
    this.successThreshold = options.successThreshold || 1;
    this.timeout = options.timeout || 10000;

    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Executes the action associated with the circuit breaker.
   * @param {...*} args - The arguments to pass to the action.
   * @returns {Promise<*>} A promise that resolves with the result of the action or rejects with an error.
   */
  async fire(...args) {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.nextAttempt <= Date.now()) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw new Error('Circuit is open. Please try again later.');
      }
    }

    try {
      const response = await this.action(...args);
      return this.success(response);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  /**
   * Records a successful execution.
   * @param {*} response - The response from the action.
   * @returns {*} The response.
   */
  success(response) {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.close();
      }
    }
    this.failureCount = 0;
    return response;
  }

  /**
   * Records a failed execution.
   * @param {*} error - The error from the action.
   */
  fail(error) {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  /**
   * Opens the circuit.
   */
  open() {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = Date.now() + this.timeout;
  }

  /**
   * Closes the circuit.
   */
  close() {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

export default CircuitBreaker;

/**
 * @fileoverview This module implements a persistent circuit breaker pattern using Supabase for state management.
 *
 * The circuit breaker prevents an application from repeatedly trying to execute an operation that is likely to fail.
 * It monitors for failures, and when the number of failures reaches a certain threshold, it "opens" the circuit,
 * preventing further calls to the service. After a timeout period, the circuit becomes "half-open," allowing a
 * single test request to pass through. If the test request succeeds, the circuit is "closed," and normal operation
 * resumes. If it fails, the circuit remains "open."
 */

import supabase from '../services/supabase';

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
 * A persistent circuit breaker that uses Supabase to store its state.
 */
class PersistentCircuitBreaker {
  /**
   * Creates a new PersistentCircuitBreaker instance.
   * @param {string} serviceName - A unique identifier for the circuit breaker instance.
   * @param {Function} action - The function to execute when the circuit is closed.
   * @param {object} options - The configuration options for the circuit breaker.
   * @param {number} [options.failureThreshold=3] - The number of failures required to open the circuit.
   * @param {number} [options.successThreshold=1] - The number of successful executions required to close the circuit.
   * @param {number} [options.timeout=10000] - The time in milliseconds to wait before transitioning to the half-open state.
   */
  constructor(serviceName, action, options = {}) {
    this.serviceName = serviceName;
    this.action = action;
    this.failureThreshold = options.failureThreshold || 3;
    this.successThreshold = options.successThreshold || 1;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Retrieves the current state of the circuit breaker from the database.
   * If no state is found, it initializes a new one.
   * @returns {Promise<object>} A promise that resolves with the current state.
   */
  async getState() {
    const { data, error } = await supabase
      .from('circuit_breaker_states')
      .select('*')
      .eq('service_name', this.serviceName)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: "object not found"
      throw new Error(error.message);
    }

    if (data) {
      return data;
    }

    const initialState = {
      service_name: this.serviceName,
      state: CircuitBreakerState.CLOSED,
      failure_count: 0,
      success_count: 0,
      next_attempt_at: new Date(Date.now()),
    };

    const { error: insertError } = await supabase
      .from('circuit_breaker_states')
      .insert([initialState]);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return initialState;
  }

  /**
   * Updates the state of the circuit breaker in the database.
   * @param {object} newState - The new state to save.
   * @returns {Promise<void>} A promise that resolves when the state has been updated.
   */
  async updateState(newState) {
	newState.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('circuit_breaker_states')
      .update(newState)
      .eq('service_name', this.serviceName);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Executes the action associated with the circuit breaker.
   * @param {...*} args - The arguments to pass to the action.
   * @returns {Promise<*>} A promise that resolves with the result of the action or rejects with an error.
   */
  async fire(...args) {
    const state = await this.getState();

    if (state.state === CircuitBreakerState.OPEN) {
      if (new Date(state.next_attempt_at) <= Date.now()) {
        await this.updateState({ state: CircuitBreakerState.HALF_OPEN });
      } else {
        throw new Error('Circuit is open. Please try again later.');
      }
    }

    try {
      const response = await this.action(...args);
      return this.success(state, response);
    } catch (error) {
      this.fail(state, error);
      throw error;
    }
  }

  /**
   * Records a successful execution.
   * @param {object} state - The current state of the circuit breaker.
   * @param {*} response - The response from the action.
   * @returns {*} The response.
   */
  async success(state, response) {
    if (state.state === CircuitBreakerState.HALF_OPEN) {
      const newSuccessCount = state.success_count + 1;
      if (newSuccessCount >= this.successThreshold) {
        await this.close();
      } else {
        await this.updateState({ success_count: newSuccessCount });
      }
    } else {
		await this.updateState({ failure_count: 0 });
	}
    return response;
  }

  /**
   * Records a failed execution.
   * @param {object} state - The current state of the circuit breaker.
   * @param {*} error - The error from the action.
   */
  async fail(state, error) {
    const newFailureCount = state.failure_count + 1;
    if (newFailureCount >= this.failureThreshold) {
      await this.open();
    } else {
      await this.updateState({ failure_count: newFailureCount, last_failure_at: new Date().toISOString() });
    }
  }

  /**
   * Opens the circuit.
   */
  async open() {
    await this.updateState({
      state: CircuitBreakerState.OPEN,
      next_attempt_at: new Date(Date.now() + this.timeout),
      last_failure_at: new Date().toISOString(),
    });
  }

  /**
   * Closes the circuit.
   */
  async close() {
    await this.updateState({
      state: CircuitBreakerState.CLOSED,
      failure_count: 0,
      success_count: 0,
    });
  }
}

export default PersistentCircuitBreaker;

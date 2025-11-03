// lib/errors/errorHandler.js
// Centralized error handling with automatic recovery

import { createClient } from '@supabase/supabase-js';
import { metrics } from '../monitoring/metrics';
import { Logger } from '../monitoring/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class ErrorHandler {
  static async handle(error, context = {}) {
    // Log error
    Logger.error('Error occurred', error, context);

    // Track metric
    await metrics.track('api_error', {
      errorType: error.constructor.name,
      message: error.message,
      context,
    });

    // Store error for analysis
    await supabase.from('errors').insert({
      error_type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // Determine recovery strategy
    return this.attemptRecovery(error, context);
  }

  static async attemptRecovery(error, context) {
    // Plaid errors - retry with exponential backoff
    if (error.message?.includes('ITEM_LOGIN_REQUIRED')) {
      return {
        recoverable: true,
        action: 'plaid_reauth',
        message: 'Bank connection expired. Please reconnect.',
      };
    }

    // Rate limit errors - suggest retry time
    if (error.message?.includes('rate limit')) {
      return {
        recoverable: true,
        action: 'retry_later',
        retryAfter: 3600,
        message: 'Too many requests. Please try again in 1 hour.',
      };
    }

    // Stripe errors - check if payment succeeded despite error
    if (error.type === 'StripeCardError') {
      return {
        recoverable: true,
        action: 'check_payment_status',
        message: 'Payment issue occurred. Checking status...',
      };
    }

    // Anthropic API errors - use fallback analysis
    if (error.message?.includes('anthropic')) {
      return {
        recoverable: true,
        action: 'fallback_analysis',
        message: 'Using alternative analysis method...',
      };
    }

    // Database errors - check connection
    if (error.message?.includes('connection')) {
      return {
        recoverable: true,
        action: 'retry_connection',
        message: 'Database connection issue. Retrying...',
      };
    }

    // Unrecoverable error
    return {
      recoverable: false,
      action: 'manual_intervention',
      message: 'An unexpected error occurred. Our team has been notified.',
    };
  }

  // Retry logic with exponential backoff
  static async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      exponentialBase = 2,
    } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        const delay = Math.min(
          initialDelay * Math.pow(exponentialBase, attempt - 1),
          maxDelay
        );

        Logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: error.message,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// ---

// lib/errors/circuitBreaker.js
// Circuit breaker pattern for external APIs

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
      
      Logger.error(`Circuit breaker ${this.name} opened`, null, {
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

// ---

// lib/errors/fallbacks.js
// Fallback strategies when primary methods fail

export class FallbackStrategies {
  // If Claude API fails, use simple rule-based leak detection
  static async fallbackLeakDetection(recurringCharges) {
    const leaks = [];

    recurringCharges.forEach(charge => {
      const merchant = charge.merchant.toLowerCase();

      // Rule 1: Detect common free software being paid for
      const freeTools = ['vscode', 'winzip', 'winrar', 'vlc', '7-zip'];
      if (freeTools.some(tool => merchant.includes(tool))) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'free_alternative',
          monthly_cost: charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12,
          annual_cost: charge.frequency === 'annual' ? charge.avgAmount : charge.avgAmount * 12,
          description: 'Paying for software that has a free alternative',
          recommendation: 'Cancel subscription and use free version',
          confidence_score: 0.95,
        });
      }

      // Rule 2: Detect zombie subscriptions (no charges in last 90 days)
      const daysSinceLastCharge = Math.floor(
        (Date.now() - new Date(charge.lastCharge).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastCharge > 90) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'zombie',
          monthly_cost: charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12,
          annual_cost: charge.frequency === 'annual' ? charge.avgAmount : charge.avgAmount * 12,
          description: `No charges in last ${daysSinceLastCharge} days - likely unused`,
          recommendation: 'Review usage and consider canceling',
          confidence_score: 0.75,
        });
      }

      // Rule 3: High-cost subscriptions (>$100/month)
      const monthlyCost = charge.frequency === 'monthly' ? charge.avgAmount : charge.avgAmount / 12;
      if (monthlyCost > 100) {
        leaks.push({
          merchant_name: charge.merchant,
          leak_type: 'unused',
          monthly_cost: monthlyCost,
          annual_cost: monthlyCost * 12,
          description: `High-cost subscription ($${monthlyCost.toFixed(2)}/month) - verify active usage`,
          recommendation: 'Review team usage and consider downgrading if underutilized',
          confidence_score: 0.60,
        });
      }
    });

    return leaks;
  }

  // If Plaid connection fails, offer manual CSV upload
  static async manualTransactionUpload(csvData) {
    // Parse CSV and return transactions
    // This is a simplified version - production would use Papa Parse
    const lines = csvData.split('\n');
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const [date, description, amount] = lines[i].split(',');
      if (date && description && amount) {
        transactions.push({
          date: date.trim(),
          merchant_name: description.trim(),
          amount: parseFloat(amount.trim()),
          category: [],
        });
      }
    }

    return transactions;
  }
}

// ---

// Add to Supabase schema:
/*
CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_errors_type ON errors(error_type, timestamp);
CREATE INDEX idx_errors_resolved ON errors(resolved);
*/
// lib/errors/errorHandler.js
// Centralized error handling with automatic recovery

import { createClient } from '@supabase/supabase-js';
// These are not implemented in the codebase, so I will comment them out for now.
// import { metrics } from '../monitoring/metrics';
// import { Logger } from '../monitoring/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export class ErrorHandler {
  static async handle(error, context = {}) {
    // Log error
    // Logger.error('Error occurred', error, context);
    console.error('Error occurred', { error, context });


    // Track metric
    // await metrics.track('api_error', {
    //   errorType: error.constructor.name,
    //   message: error.message,
    //   context,
    // });

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

        // Logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        //   error: error.message,
        // });
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: error.message,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

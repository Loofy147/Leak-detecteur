// lib/security/rateLimiter.js
// Rate limiting to prevent abuse and API cost overruns

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class RateLimiter {
  constructor() {
    this.limits = {
      checkout: { max: 5, window: 3600 }, // 5 checkout attempts per hour per IP
      plaid_link: { max: 10, window: 3600 }, // 10 Plaid connections per hour per IP
      api_general: { max: 100, window: 60 }, // 100 API calls per minute per IP
    };
  }

  async checkLimit(identifier, action = 'api_general') {
    const limit = this.limits[action];
    if (!limit) return { allowed: true };

    const windowStart = new Date(Date.now() - limit.window * 1000);

    // Query recent attempts from rate_limits table
    const { data, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString());

    if (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Fail open in case of DB issues
    }

    const attemptCount = data?.length || 0;

    if (attemptCount >= limit.max) {
      return {
        allowed: false,
        retryAfter: limit.window,
        message: `Rate limit exceeded. Try again in ${Math.ceil(limit.window / 60)} minutes.`,
      };
    }

    // Log this attempt
    await supabase.from('rate_limits').insert({
      identifier,
      action,
      created_at: new Date().toISOString(),
    });

    return { allowed: true, remaining: limit.max - attemptCount - 1 };
  }
}

export const rateLimiter = new RateLimiter();

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

// ---

// lib/security/validator.js
// Input validation and sanitization

export class InputValidator {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    if (email.length > 255) {
      return { valid: false, error: 'Email too long' };
    }
    return { valid: true, sanitized: email.toLowerCase().trim() };
  }

  static validateCompanyName(name) {
    if (!name) return { valid: true, sanitized: null };
    if (typeof name !== 'string') {
      return { valid: false, error: 'Invalid company name' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Company name too long' };
    }
    // Remove potential XSS
    const sanitized = name.replace(/[<>]/g, '').trim();
    return { valid: true, sanitized };
  }

  static validateAuditId(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'Audit ID required' };
    }
    if (!uuidRegex.test(id)) {
      return { valid: false, error: 'Invalid audit ID format' };
    }
    return { valid: true, sanitized: id };
  }
}

// ---

// lib/security/middleware.js
// Security middleware for API routes

import { rateLimiter } from './rateLimiter';

export function withSecurity(handler, options = {}) {
  return async (req, res) => {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 2. Rate limiting
    const identifier = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const rateLimitResult = await rateLimiter.checkLimit(
      identifier,
      options.rateLimitAction || 'api_general'
    );

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: rateLimitResult.message,
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // 3. Content-Type validation
    if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({ error: 'Content-Type must be application/json' });
    }

    // 4. Request size limit (already handled by Next.js, but explicit check)
    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1000000) {
      return res.status(413).json({ error: 'Request too large' });
    }

    // 5. Execute handler with error boundary
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      
      // Don't leak internal errors to client
      return res.status(500).json({
        error: 'Internal server error',
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    }
  };
}

// ---

// Add to Supabase schema:
/*
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_identifier_action ON rate_limits(identifier, action, created_at);

-- Auto-cleanup old rate limit entries (runs daily)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *', 'SELECT cleanup_rate_limits()');
*/
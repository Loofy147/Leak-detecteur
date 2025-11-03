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

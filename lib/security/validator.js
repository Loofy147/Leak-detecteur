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

// lib/security/validator.js
// Input validation and sanitization

/**
 * Provides methods for validating and sanitizing user inputs to ensure data integrity and prevent security vulnerabilities.
 */
export class InputValidator {
  /**
   * Validates and sanitizes an email address.
   * @param {string} email - The email address to validate.
   * @returns {{valid: boolean, error?: string, sanitized?: string}} An object indicating if the email is valid.
   * If valid, it includes the sanitized email. If invalid, it includes an error message.
   */
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

  /**
   * Validates and sanitizes a company name.
   * @param {string} name - The company name to validate.
   * @returns {{valid: boolean, error?: string, sanitized?: string}} An object indicating if the name is valid.
   * If valid, it includes the sanitized name. If invalid, it includes an error message.
   */
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

  /**
   * Validates a UUID.
   * @param {string} id - The UUID to validate.
   * @returns {{valid: boolean, error?: string, sanitized?: string}} An object indicating if the UUID is valid.
   * If valid, it includes the original ID. If invalid, it includes an error message.
   */
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

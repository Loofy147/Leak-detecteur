/**
 * @fileoverview This module provides a middleware for validating API requests.
 * It uses the `joi` library to validate the request body against a given schema.
 */

/**
 * A middleware that validates the request body against a Joi schema.
 * @param {import('joi').Schema} schema - The Joi schema to validate against.
 * @returns {Function} An Express-style middleware function.
 */
export function withValidation(schema) {
  return function (handler) {
    return async function (req, res) {
      try {
        await schema.validateAsync(req.body);
        return handler(req, res);
      } catch (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
    };
  };
}

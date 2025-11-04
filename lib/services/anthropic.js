/**
 * @fileoverview Initializes and exports the Anthropic AI SDK client.
 * This module configures the client with the necessary API key and sets
 * `dangerouslyAllowBrowser` to true in test environments to accommodate the Jest/JSDOM environment.
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // This is required for the Jest/JSDOM test environment
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
});

export default anthropic;

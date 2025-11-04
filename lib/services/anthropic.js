// lib/services/anthropic.js
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // This is required for the Jest/JSDOM test environment
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
});

export default anthropic;

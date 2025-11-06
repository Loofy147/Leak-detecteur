// lib/ai_analyzer.test.js
import Anthropic from '@anthropic-ai/sdk';
import { analyzeWithAI } from './ai_analyzer';
import supabase from './services/supabase';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

// Mock Supabase
jest.mock('./services/supabase', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: 'test-id', state: 'CLOSED', failure_count: 0, success_count: 0, next_attempt_at: Date.now() }, error: null }),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
}));


describe('analyzeWithAI', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    supabase.from.mockReturnThis();
    supabase.select.mockReturnThis();
    supabase.eq.mockReturnThis();
    supabase.single.mockResolvedValue({ data: { id: 'test-id', state: 'CLOSED', failure_count: 0, success_count: 0, next_attempt_at: Date.now() }, error: null });
    supabase.insert.mockReturnThis();
    supabase.update.mockReturnThis();
  });

  it('should correctly parse a valid JSON response from the AI', async () => {
    const recurringCharges = [{ merchant: 'Test Merchant' }];
    const aiResponse = {
      content: [{
        text: `[
          {
            "merchant_name": "Test Merchant",
            "leak_type": "zombie",
            "monthly_cost": 10.00,
            "annual_cost": 120.00,
            "description": "Test description",
            "recommendation": "Test recommendation",
            "confidence_score": 0.9
          }
        ]`
      }]
    };
    const mockCreate = jest.fn().mockResolvedValue(aiResponse);
    Anthropic.prototype.messages = { create: mockCreate };

    const result = await analyzeWithAI(recurringCharges, 'audit-123');
    expect(result).toHaveLength(1);
    expect(result[0].merchant_name).toBe('Test Merchant');
    expect(result[0].leak_type).toBe('zombie');
    expect(result[0].audit_id).toBe('audit-123');
  });

  it('should return an empty array if the AI response is not valid JSON', async () => {
    const recurringCharges = [{ merchant: 'Test Merchant' }];
    const aiResponse = {
      content: [{
        text: 'This is not JSON.'
      }]
    };
    const mockCreate = jest.fn().mockResolvedValue(aiResponse);
    Anthropic.prototype.messages = { create: mockCreate };

    const result = await analyzeWithAI(recurringCharges, 'audit-123');
    expect(result).toEqual([]);
  });

  it('should return an empty array if the AI call fails', async () => {
    const recurringCharges = [{ merchant: 'Test Merchant' }];
    const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));
    Anthropic.prototype.messages = { create: mockCreate };

    const result = await analyzeWithAI(recurringCharges, 'audit-123');
    expect(result).toEqual([]);
  });
});

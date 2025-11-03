// pages/api/analyze/detect-leaks.test.js
import { createMocks } from 'node-mocks-http';
import handler from './detect-leaks';
import { detectRecurringCharges } from '../../../lib/recurring_charges';
import { analyzeWithAI } from '../../../lib/ai_analyzer';
import supabase from '../../../lib/services/supabase';

jest.mock('../../../lib/recurring_charges');
jest.mock('../../../lib/ai_analyzer');
jest.mock('../../../lib/services/supabase');

describe('/api/analyze/detect-leaks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockImplementation(tableName => {
      if (tableName === 'rate_limits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn().mockResolvedValue({}),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockReturnThis(),
      };
    });
  });

  it('should return 500 if no transactions are found', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Internal server error', requestId: 'unknown' });
  });

  it('should successfully detect leaks and update the audit', async () => {
    supabase.from.mockImplementation(tableName => {
      if (tableName === 'rate_limits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn().mockResolvedValue({}),
        };
      }
      if (tableName === 'transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null }),
        };
      }
      return {
        insert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    });
    detectRecurringCharges.mockReturnValue([{ merchant: 'test', amount: 10 }]);
    analyzeWithAI.mockResolvedValue([{ merchant_name: 'test', annual_cost: 120 }]);

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 1,
      totalWaste: 120,
    });
  });

  it('should handle cases where no leaks are found', async () => {
    supabase.from.mockImplementation(tableName => {
      if (tableName === 'rate_limits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn().mockResolvedValue({}),
        };
      }
      if (tableName === 'transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null }),
        };
      }
      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    });
    detectRecurringCharges.mockReturnValue([]);
    analyzeWithAI.mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 0,
      totalWaste: 0,
    });
  });
});

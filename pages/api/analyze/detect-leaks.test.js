// pages/api/analyze/detect-leaks.test.js
const { createMocks } = require('node-mocks-http');
const handler = require('./detect-leaks');
const { detectRecurringCharges, analyzeWithAI } = require('../../../lib/transaction_helpers');
const { createClient } = require('@supabase/supabase-js');

jest.mock('../../../lib/transaction_helpers');
jest.mock('@supabase/supabase-js');

describe('/api/analyze/detect-leaks', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };
    createClient.mockReturnValue(mockSupabase);
  });

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res._getJSONData()).toEqual({ error: 'Method not allowed' });
  });

  it('should return 500 if no transactions are found', async () => {
    mockSupabase.order.mockResolvedValue({ data: [], error: null });

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to detect leaks' });
  });

  it('should successfully detect leaks and update the audit', async () => {
    mockSupabase.order.mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null });
    detectRecurringCharges.mockReturnValue([{ merchant: 'test', amount: 10 }]);
    analyzeWithAI.mockResolvedValue([{ merchant_name: 'test', annual_cost: 120 }]);

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 1,
      totalWaste: 120,
    });
    expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.update).toHaveBeenCalledTimes(1);
  });

  it('should handle cases where no leaks are found', async () => {
    mockSupabase.order.mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null });
    detectRecurringCharges.mockReturnValue([]);
    analyzeWithAI.mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 0,
      totalWaste: 0,
    });
    expect(mockSupabase.insert).not.toHaveBeenCalled();
    expect(mockSupabase.update).toHaveBeenCalledTimes(1);
  });
});

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
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to detect leaks' });
  });

  it('should successfully detect leaks and update the audit', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null }),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockReturnThis(),
    });
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
    expect(supabase.from).toHaveBeenCalledWith('leaks');
    expect(supabase.from).toHaveBeenCalledWith('audits');
  });

  it('should handle cases where no leaks are found', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: 1, amount: 10 }], error: null }),
      update: jest.fn().mockReturnThis(),
    });
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
    expect(supabase.from).not.toHaveBeenCalledWith('leaks');
    expect(supabase.from).toHaveBeenCalledWith('audits');
  });
});

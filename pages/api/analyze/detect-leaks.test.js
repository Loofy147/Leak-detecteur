// pages/api/analyze/detect-leaks.test.js
import { createMocks } from 'node-mocks-http';
import handler from './detect-leaks';
import supabase from '../../../lib/services/supabase';
import { detectRecurringCharges } from '../../../lib/recurring_charges';
import { analyzeWithAI } from '../../../lib/ai_analyzer';

jest.mock('../../../lib/services/supabase');
jest.mock('../../../lib/recurring_charges');
jest.mock('../../../lib/ai_analyzer');

const TEST_AUDIT_ID = '123e4567-e89b-12d3-a456-426614174000';

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
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to detect leaks' });
  });

  it('should successfully detect leaks and update the audit', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [{ id: 1 }] }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      }),
    });
    detectRecurringCharges.mockReturnValue([{ merchant: 'Netflix' }]);
    analyzeWithAI.mockResolvedValue([{ annual_cost: 120 }]);

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 1,
      totalWaste: 120,
    });
  });

  it('should handle cases where no leaks are found', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [{ id: 1 }] }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      }),
    });
    detectRecurringCharges.mockReturnValue([]);
    analyzeWithAI.mockResolvedValue([]);

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      leaksFound: 0,
      totalWaste: 0,
    });
    expect(supabase.from).not.toHaveBeenCalledWith('leaks');
  });
});

// pages/api/analyze/fetch-transactions.test.js
import { createMocks } from 'node-mocks-http';
import handler from './fetch-transactions';
import plaidClient from '../../../lib/services/plaid';
import supabase from '../../../lib/services/supabase';

jest.mock('../../../lib/services/plaid');
jest.mock('../../../lib/services/supabase');

const TEST_AUDIT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('/api/analyze/fetch-transactions', () => {
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

  it('should return 400 if no access token is found', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'No access token found' });
  });

  it('should fetch and store transactions successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { plaid_access_token: 'test' } }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      }),
      insert: jest.fn().mockResolvedValue({}),
    });
    plaidClient.transactionsGet.mockResolvedValue({
      data: { transactions: [{ transaction_id: '1' }] },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true, transactionCount: 1 });
    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(supabase.from).toHaveBeenCalledWith('audits');
  });

  it('should return 500 if fetching transactions fails', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: TEST_AUDIT_ID },
    });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { plaid_access_token: 'test' } }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      }),
    });
    plaidClient.transactionsGet.mockRejectedValue(new Error('Plaid error'));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to fetch transactions' });
    expect(supabase.from).toHaveBeenCalledWith('audits');
  });
});

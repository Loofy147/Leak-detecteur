// pages/api/analyze/fetch-transactions.test.js
const { createMocks } = require('node-mocks-http');
const handler = require('./fetch-transactions');
const { createClient } = require('@supabase/supabase-js');
const { PlaidApi } = require('plaid');

jest.mock('@supabase/supabase-js');
jest.mock('plaid');

describe('/api/analyze/fetch-transactions', () => {
  let mockSupabase;
  let mockPlaid;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      insert: jest.fn().mockResolvedValue({}),
    };
    createClient.mockReturnValue(mockSupabase);

    mockPlaid = {
      transactionsGet: jest.fn(),
    };
    PlaidApi.mockImplementation(() => mockPlaid);
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
    mockSupabase.single.mockResolvedValue({ data: null, error: null });

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'No access token found' });
  });

  it('should fetch and store transactions successfully', async () => {
    mockSupabase.single.mockResolvedValue({ data: { plaid_access_token: 'test-token' }, error: null });
    mockPlaid.transactionsGet.mockResolvedValue({ data: { transactions: [{ transaction_id: '1', amount: 10 }] } });

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true, transactionCount: 1 });
    expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.update).toHaveBeenCalledTimes(1);
  });

  it('should return 500 if fetching transactions fails', async () => {
    mockSupabase.single.mockResolvedValue({ data: { plaid_access_token: 'test-token' }, error: null });
    mockPlaid.transactionsGet.mockRejectedValue(new Error('Plaid error'));

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to fetch transactions' });
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'failed', metadata: { error: 'Plaid error' } });
  });
});

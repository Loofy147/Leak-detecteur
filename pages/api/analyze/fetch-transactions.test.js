// pages/api/analyze/fetch-transactions.test.js
import { createMocks } from 'node-mocks-http';
import handler from './fetch-transactions';
import supabase from '../../../lib/services/supabase';
import plaidClient from '../../../lib/services/plaid';

jest.mock('../../../lib/services/supabase');
jest.mock('../../../lib/services/plaid');

describe('/api/analyze/fetch-transactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fromMock = jest.fn().mockImplementation(tableName => {
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
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({}),
      };
    });
    supabase.from = fromMock;
  });

  it('should return 400 if no access token is found', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'No access token found' });
  });

  it('should fetch and store transactions successfully', async () => {
    supabase.from.mockImplementation(tableName => {
      if (tableName === 'rate_limits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn().mockResolvedValue({}),
        };
      }
      if (tableName === 'audits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { plaid_access_token: 'test-token' }, error: null }),
          update: jest.fn().mockReturnThis(),
        };
      }
      return {
        insert: jest.fn().mockResolvedValue({}),
      };
    });

    plaidClient.transactionsGet.mockResolvedValue({ data: { transactions: [{ transaction_id: '1', amount: 10 }] } });

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ success: true, transactionCount: 1 });
  });

  it('should return 500 if fetching transactions fails', async () => {
    supabase.from.mockImplementation(tableName => {
      if (tableName === 'rate_limits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          insert: jest.fn().mockResolvedValue({}),
        };
      }
      if (tableName === 'audits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { plaid_access_token: 'test-token' }, error: null }),
          update: jest.fn().mockReturnThis(),
        };
      }
      return {};
    });

    plaidClient.transactionsGet.mockRejectedValue(new Error('Plaid error'));

    const { req, res } = createMocks({
      method: 'POST',
      body: { auditId: 'test-audit' },
      headers: { 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'Failed to fetch transactions' });
  });
});

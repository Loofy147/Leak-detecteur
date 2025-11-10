
import { createMocks } from 'node-mocks-http';
import handler from './index';
import { createServerClient } from '@supabase/ssr';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  })),
}));

describe('/api/subscriptions', () => {
  it('returns subscriptions for an authenticated user', async () => {
    const { createServerClient } = require('@supabase/ssr');
    const getUser = jest.fn().mockResolvedValueOnce({
      data: { user: { id: '123' } },
    });
    const eq = jest.fn().mockResolvedValueOnce({
      data: [{ id: 'sub1', name: 'Netflix' }],
      error: null,
    });
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    createServerClient.mockReturnValueOnce({ auth: { getUser }, from });


    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const subscriptions = JSON.parse(res._getData());
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].name).toBe('Netflix');
  });

  it('returns a 401 for an unauthenticated user', async () => {
    const { createServerClient } = require('@supabase/ssr');
    const getUser = jest.fn().mockResolvedValueOnce({
      data: { user: null },
    });
    createServerClient.mockReturnValueOnce({ auth: { getUser } });

    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });
});

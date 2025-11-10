
import { createMocks } from 'node-mocks-http';
import handler from './get-user';

describe('/api/user/get-user', () => {
  it('returns a mock user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const user = JSON.parse(res._getData());
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
  });

  it('returns a 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });
});

// pages/api/payments/webhook.test.js
import { createMocks } from 'node-mocks-http';
import webhookHandler from './webhook';
import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';
import { addEmailToQueue } from '../../../lib/emailQueue';
import { buffer } from 'micro';

jest.mock('../../../lib/services/stripe');
jest.mock('../../../lib/services/supabase', () => ({
  from: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
}));
jest.mock('../../../lib/emailQueue');
jest.mock('micro');

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockReturnThis();
    supabase.update.mockReturnThis();
    supabase.eq.mockReturnThis();
    supabase.insert.mockReturnThis();
  });

  it('should send a welcome email on checkout.session.completed', async () => {
    // Mock Stripe event
    const mockSession = {
      id: 'cs_test_123',
      payment_intent: 'pi_test_123',
      metadata: { audit_id: 'audit_abc' },
      customer_email: 'test@example.com',
    };
    const mockEvent = {
      type: 'checkout.session.completed',
      data: { object: mockSession },
    };

    stripe.webhooks.constructEvent.mockReturnValue(mockEvent);
    buffer.mockResolvedValue('rawBody');

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test', 'Content-Type': 'application/json' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    await webhookHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('audits');
    expect(addEmailToQueue).toHaveBeenCalledWith(
      'test@example.com',
      process.env.FROM_EMAIL,
      'Welcome to LeakDetector - Next Steps',
      expect.any(String)
    );
  });
});

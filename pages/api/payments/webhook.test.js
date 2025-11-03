// pages/api/payments/webhook.test.js
import { createMocks } from 'node-mocks-http';
import webhookHandler from './webhook';
import stripe from '../../../lib/services/stripe';
import supabase from '../../../lib/services/supabase';
import resend from '../../../lib/services/resend';
import { buffer } from 'micro';

jest.mock('../../../lib/services/stripe');
jest.mock('../../../lib/services/supabase');
jest.mock('../../../lib/services/resend');
jest.mock('micro');

describe('Stripe Webhook Handler', () => {
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

    // Mock Supabase and Resend
    const updateMock = jest.fn().mockResolvedValue({ error: null });
    const eqMock = jest.fn().mockReturnValue({ update: updateMock });
    supabase.from.mockReturnValue({ update: jest.fn().mockReturnValue({ eq: eqMock }) });

    resend.emails.send.mockResolvedValue({});

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
    });

    await webhookHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('audits');
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Welcome to LeakDetector - Next Steps',
      })
    );
  });
});

/**
 * @fileoverview This module initializes and exports a singleton instance of the Stripe API client.
 *
 * This client is configured using an environment variable for the Stripe secret key. It is used
 * for all interactions with the Stripe API, including creating and managing subscriptions,
 * processing payments, and handling webhooks.
 */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default stripe;

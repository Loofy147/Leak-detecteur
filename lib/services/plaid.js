/**
 * @fileoverview This module initializes and exports a singleton instance of the Plaid API client.
 *
 * This client is configured using environment variables for the Plaid environment, client ID, and secret.
 * It is used for all interactions with the Plaid API, such as fetching transactions and managing items.
 */
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export default plaidClient;

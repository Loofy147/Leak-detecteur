/**
 * @fileoverview This module initializes and exports a singleton instance of the Resend API client.
 *
 * This client is configured using an environment variable for the Resend API key. It is used
 * for sending transactional emails, such as reports and notifications, to users.
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;

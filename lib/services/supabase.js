/**
 * @fileoverview This module initializes and exports a singleton instance of the Supabase client.
 *
 * This client is configured using environment variables for the Supabase URL and service role key.
 * It is used for all interactions with the Supabase database, including querying, inserting,
 * updating, and deleting data.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;

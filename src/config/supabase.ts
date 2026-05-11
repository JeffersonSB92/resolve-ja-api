import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const backendAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabaseAnonClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  backendAuthOptions,
);

// WARNING: This client uses the service role key and must only be used on the backend.
export const supabaseAdminClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  backendAuthOptions,
);

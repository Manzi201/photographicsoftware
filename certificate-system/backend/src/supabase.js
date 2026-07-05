const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is not set.');
  console.error('   Render Dashboard → Environment → Add Variable:');
  console.error('   SUPABASE_URL = https://axeqcokrynwefeovucti.supabase.co');
  // Don't exit — let server start so health check works
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is not set.');
}

// Create clients only if URL is available
const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function getUserClient(token) {
  if (!SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Export a proxy that gives clear errors if supabase not configured
const supabaseProxy = supabase || new Proxy({}, {
  get: (_, prop) => {
    if (prop === 'auth') return {
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      admin: { createUser: async () => ({ data: null, error: new Error('Supabase not configured') }) },
    };
    return () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('Supabase not configured') }) }) }),
    });
  },
});

module.exports = { supabase: supabaseProxy, getUserClient };

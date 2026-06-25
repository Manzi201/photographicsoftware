const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Validate required env vars and give clear error
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is not set. Add it to Render Environment Variables.');
  console.error('   Go to: Render Dashboard → Your Service → Environment → Add Variable');
  console.error('   SUPABASE_URL = https://axeqcokrynwefeovucti.supabase.co');
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is not set. Add it to Render Environment Variables.');
  process.exit(1);
}

// Service-role client (bypasses RLS — for server-side operations)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// User-scoped client (respects RLS) using their JWT
function getUserClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = { supabase, getUserClient };

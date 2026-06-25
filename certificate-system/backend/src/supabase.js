const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Service-role client (bypasses RLS — for server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create a user-scoped client (respects RLS) using their JWT
function getUserClient(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

module.exports = { supabase, getUserClient };

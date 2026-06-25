import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://axeqcokrynwefeovucti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4ZXFjb2tyeW53ZWZlb3Z1Y3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzgwNzAsImV4cCI6MjA5Nzk1NDA3MH0.cwECvjRpFkqkwqGBZK6J7u3J2E5IkHP-dxJKf8XMx5g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

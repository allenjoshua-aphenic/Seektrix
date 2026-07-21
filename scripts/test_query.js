import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function formatSupabaseUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}.supabase.co`;
  }
  return trimmed;
}

const rawUrl = process.env.VITE_SUPABASE_URL;
const url = formatSupabaseUrl(rawUrl);
const key = process.env.VITE_SUPABASE_ANON_KEY;

console.log("Formatted URL:", url);
console.log("Key from env:", key ? "SET" : "NOT SET");

if (!url || !key) {
  console.error("Missing credentials.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.rpc('get_columns_info'); // or direct query if possible, let's try reading a column that might fail or select information schema if permitted
    console.log("Checking table by fetching a select with empty results...");
    const { data: cols, error: err } = await supabase.from('unclaimed_assets').select().limit(1);
    if (err) {
      console.error("Select failed:", err.message);
    } else {
      console.log("Successfully selected from unclaimed_assets table!");
      console.log("Columns present in returned row:", cols.length > 0 ? Object.keys(cols[0]) : "No rows returned, cannot determine columns this way.");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

test();

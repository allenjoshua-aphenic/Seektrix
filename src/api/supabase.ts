import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Lazily retrieves or initializes the Supabase client instance.
 * Checks for client-side VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase client-side credentials (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not set. Please supply them in your environment settings.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

/**
 * Validates connection against the client-side Supabase credentials by executing a test query.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        message: 'Credentials missing in client-side environment. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are specified.'
      };
    }

    const client = getSupabaseClient();
    
    // Select one record from unclaimed_assets to test reading capabilities and table existence
    const { data, error } = await client.from('unclaimed_assets').select().limit(1);
    
    if (error) {
      // If table is not found, the connection might be valid but schema needs to be deployed.
      return {
        success: false,
        message: `Connected to Supabase endpoint, but table query failed: ${error.message} (Code: ${error.code})`,
        details: error
      };
    }

    return {
      success: true,
      message: 'Supabase connection successfully validated. Verified read access on unclaimed_assets ledger!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'An unexpected error occurred while initiating database handshake.'
    };
  }
}

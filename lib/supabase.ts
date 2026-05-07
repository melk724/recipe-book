import { createBrowserClient } from '@supabase/ssr';

// For use in client components. Reads the session from cookies
// so RLS sees auth.uid() correctly.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Convenience export — most components just import { supabase }
export const supabase = createClient();

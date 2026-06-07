/**
 * supabase.ts — Supabase client configuration for GuardOS.
 *
 * Import `supabase` anywhere in the app to interact with your
 * Supabase project (database, auth, storage, realtime, etc.).
 *
 * Example usage:
 *   import { supabase } from "@/supabase";
 *   const { data, error } = await supabase.from("guards").select("*");
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || "https://wkikrttgryiqasuxztmm.supabase.co";

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  || "sb_publishable_R8VXW3bbMt8BDSwspezlXw_mFHjRs1t";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

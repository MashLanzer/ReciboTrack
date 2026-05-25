import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// null when env vars are absent from the Vercel build — callers must guard.
// Calling createClient at module level with undefined keys throws synchronously
// and crashes the entire (app) layout; returning null lets features degrade
// gracefully while the rest of the app keeps working.
export const supabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Type-safe DB query helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

// Database types (simplified)
export interface Database {
  public: {
    Tables: {
      profiles: { Row: any; Insert: any; Update: any };
      matches: { Row: any; Insert: any; Update: any };
      bookings: { Row: any; Insert: any; Update: any };
      messages: { Row: any; Insert: any; Update: any };
      reviews: { Row: any; Insert: any; Update: any };
    };
  };
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wbzwxckhijkeqrnzrvro.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indiend4Y2toaWprZXFybnpydnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTU1NDQsImV4cCI6MjA3MDYzMTU0NH0.QGaf3kJwOrkYfzwpIS-Hhz3l_041xKgRX8S1P3FRluk";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      redirectTo: `${siteUrl}/auth/callback`
    }
  }
);

// Types
export interface User {
  id: string;
  email: string;
  user_metadata: {
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

export interface Learning {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  difficulty_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  user_id: string;
  created_at: string;
  updated_at: string;
  categories?: Category[];
}
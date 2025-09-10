import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wbzwxckhijkeqrnzrvro.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indiend4Y2toaWprZXFybnpydnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTU1NDQsImV4cCI6MjA3MDYzMTU0NH0.QGaf3kJwOrkYfzwpIS-Hhz3l_041xKgRX8S1P3FRluk";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface ShareToken {
  id: string;
  token: string;
  item_type: 'learning' | 'resource';
  item_id: string;
  user_id: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PublicLearning {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  difficulty_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

export interface PublicResource {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

// Share functionality functions
export async function createShareToken(itemType: 'learning' | 'resource', itemId: string, userId: string, expiresAt?: Date): Promise<ShareToken> {
  const token = generateRandomToken();
  
  const { data, error } = await supabase
    .from('share_tokens')
    .insert({
      token,
      item_type: itemType,
      item_id: itemId,
      user_id: userId,
      expires_at: expiresAt?.toISOString() || null,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getShareToken(token: string): Promise<ShareToken | null> {
  const { data, error } = await supabase
    .from('share_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .single();

  if (error) return null;
  return data;
}

export async function getPublicLearning(token: string): Promise<PublicLearning | null> {
  try {
    // First get the share token
    const shareToken = await getShareToken(token);
    if (!shareToken || shareToken.item_type !== 'learning') return null;

    // Now fetch the learning data
    const { data, error } = await supabase
      .from('learning')
      .select(`
        *,
        learning_categories(
          category_id,
          categories(*)
        )
      `)
      .eq('id', shareToken.item_id)
      .single();

    if (error) {
      console.error('Error fetching public learning:', error);
      return null;
    }
    
    // Transform the data to match PublicLearning interface
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      url: data.url,
      tags: data.tags || [],
      difficulty_level: data.difficulty_level,
      created_at: data.created_at,
      updated_at: data.updated_at,
      categories: data.learning_categories?.map((lc: any) => lc.categories) || []
    };
  } catch (error) {
    console.error('Error in getPublicLearning:', error);
    return null;
  }
}

export async function getPublicResource(token: string): Promise<PublicResource | null> {
  try {
    // First get the share token
    const shareToken = await getShareToken(token);
    if (!shareToken || shareToken.item_type !== 'resource') return null;

    // Now fetch the resource data
    const { data, error } = await supabase
      .from('resources')
      .select(`
        *,
        resource_categories(
          category_id,
          categories(*)
        )
      `)
      .eq('id', shareToken.item_id)
      .single();

    if (error) {
      console.error('Error fetching public resource:', error);
      return null;
    }
    
    // Transform the data to match PublicResource interface
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      url: data.url,
      tags: data.tags || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      categories: data.resource_categories?.map((rc: any) => rc.categories) || []
    };
  } catch (error) {
    console.error('Error in getPublicResource:', error);
    return null;
  }
}

export async function deactivateShareToken(token: string): Promise<void> {
  const { error } = await supabase
    .from('share_tokens')
    .update({ is_active: false })
    .eq('token', token);

  if (error) throw error;
}

export async function getUserShareTokens(userId: string): Promise<ShareToken[]> {
  const { data, error } = await supabase
    .from('share_tokens')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
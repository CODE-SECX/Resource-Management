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

// Normalized taxonomy types
export interface Subcategory {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

// Note: This Tag interface represents the normalized Tag entity that belongs to a subcategory.
// "color" is optional for backward compatibility with any legacy UI that expected it.
export interface Tag {
  id: string;
  user_id: string;
  subcategory_id?: string | null;
  category_id?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  subcategories: string[];
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
  subcategories: string[];
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
  subcategories: string[];
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
  subcategories: string[];
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
      subcategories: data.subcategories || [],
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
      subcategories: data.subcategories || [],
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

// Payload interfaces
export interface Payload {
  id: string;
  user_id: string;
  title: string;
  payload: string;
  description?: string;
  category: string;
  subcategories: string[];
  tags: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  target_type: 'web' | 'api' | 'mobile' | 'network' | 'other';
  is_favorite: boolean;
  is_private: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayloadStats {
  user_id: string;
  total_payloads: number;
  favorite_payloads: number;
  critical_payloads: number;
  high_payloads: number;
  medium_payloads: number;
  low_payloads: number;
  info_payloads: number;
  unique_categories: number;
  unique_subcategories: number;
  unique_tags: number;
  max_usage_count: number;
  avg_usage_count: number;
  last_created: string | null;
}

export interface PayloadFilters {
  search?: string;
  category?: string;
  subcategories?: string[];
  tags?: string[];
  severity?: string[];
  target_type?: string[];
  is_favorite?: boolean;
  sort_by?: 'created_at' | 'updated_at' | 'usage_count' | 'title' | 'severity';
  sort_order?: 'asc' | 'desc';
}

// Payload API functions
export async function getPayloads(userId: string, filters?: PayloadFilters): Promise<Payload[]> {
  let query = supabase
    .from('payloads')
    .select('*')
    .eq('user_id', userId);

  // Apply filters
  if (filters?.search) {
    // Use full-text search
    query = query.textSearch('search_vector', filters.search, {
      type: 'websearch',
      config: 'english'
    });
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.subcategories && filters.subcategories.length > 0) {
    query = query.contains('subcategories', filters.subcategories);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  if (filters?.severity && filters.severity.length > 0) {
    query = query.in('severity', filters.severity);
  }

  if (filters?.target_type && filters.target_type.length > 0) {
    query = query.in('target_type', filters.target_type);
  }

  if (filters?.is_favorite !== undefined) {
    query = query.eq('is_favorite', filters.is_favorite);
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at';
  const sortOrder = filters?.sort_order || 'desc';
  
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getPayload(id: string): Promise<Payload | null> {
  const { data, error } = await supabase
    .from('payloads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createPayload(payload: Omit<Payload, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'usage_count'>, userId: string): Promise<Payload> {
  const { data, error } = await supabase
    .from('payloads')
    .insert({
      ...payload,
      user_id: userId,
      usage_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePayload(id: string, updates: Partial<Payload>): Promise<Payload> {
  const { data, error } = await supabase
    .from('payloads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePayload(id: string): Promise<void> {
  const { error } = await supabase
    .from('payloads')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function incrementPayloadUsage(id: string): Promise<void> {
  // First get current usage count
  const { data: currentData, error: fetchError } = await supabase
    .from('payloads')
    .select('usage_count')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching current usage count:', fetchError);
    return;
  }

  // Update with incremented count
  const { error } = await supabase
    .from('payloads')
    .update({ 
      usage_count: (currentData?.usage_count || 0) + 1,
      last_used_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Error incrementing usage count:', error);
  }
}

export async function getPayloadStats(userId: string): Promise<PayloadStats> {
  const { data, error } = await supabase
    .from('payload_stats')
    .select('*')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    // Return default stats if no data exists
    return {
      user_id: userId,
      total_payloads: 0,
      favorite_payloads: 0,
      critical_payloads: 0,
      high_payloads: 0,
      medium_payloads: 0,
      low_payloads: 0,
      info_payloads: 0,
      unique_categories: 0,
      unique_subcategories: 0,
      unique_tags: 0,
      max_usage_count: 0,
      avg_usage_count: 0,
      last_created: null
    };
  }
  
  return data[0];
}

export async function getPayloadCategories(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('payloads')
    .select('category')
    .eq('user_id', userId)
    .order('category');

  if (error) throw error;
  
  // Get unique categories
  const categories = [...new Set(data?.map(item => item.category) || [])];
  return categories;
}

export async function getPayloadSubcategories(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('payloads')
    .select('subcategories')
    .eq('user_id', userId);

  if (error) throw error;
  
  // Get unique subcategories
  const subcategories = new Set<string>();
  data?.forEach(item => {
    item.subcategories?.forEach((sub: string) => subcategories.add(sub));
  });
  
  return Array.from(subcategories).sort();
}

export async function getPayloadTags(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('payloads')
    .select('tags')
    .eq('user_id', userId);

  if (error) throw error;
  
  // Get unique tags
  const tags = new Set<string>();
  data?.forEach(item => {
    item.tags?.forEach((tag: string) => tags.add(tag));
  });
  
  return Array.from(tags).sort();
}

export async function getPayloadSubcategoriesByCategory(userId: string, category: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('payloads')
    .select('subcategories')
    .eq('user_id', userId)
    .eq('category', category);

  if (error) throw error;
  
  // Get unique subcategories for the specific category
  const subcategories = new Set<string>();
  data?.forEach(item => {
    item.subcategories?.forEach((sub: string) => subcategories.add(sub));
  });
  
  return Array.from(subcategories).sort();
}

export async function getPayloadTagsByCategory(userId: string, category: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('payloads')
    .select('tags')
    .eq('user_id', userId)
    .eq('category', category);

  if (error) throw error;
  
  // Get unique tags for the specific category
  const tags = new Set<string>();
  data?.forEach(item => {
    item.tags?.forEach((tag: string) => tags.add(tag));
  });
  
  return Array.from(tags).sort();
}

// ----------------------------
// Normalized taxonomy helpers
// ----------------------------

// Subcategories CRUD
export async function getSubcategories(userId: string, categoryId?: string): Promise<Subcategory[]> {
  let query = supabase
    .from('subcategories')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createSubcategory(input: { user_id: string; category_id: string; name: string; description?: string; color?: string; }): Promise<Subcategory> {
  const { data, error } = await supabase
    .from('subcategories')
    .insert([{ ...input }])
    .select('*')
    .single();
  if (error) throw error;
  return data as Subcategory;
}

export async function updateSubcategory(id: string, updates: Partial<Pick<Subcategory, 'name' | 'description' | 'color'>>): Promise<Subcategory> {
  const { data, error } = await supabase
    .from('subcategories')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Subcategory;
}

export async function deleteSubcategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Tags CRUD (normalized)
export async function getTags(userId: string, subcategoryId?: string): Promise<Tag[]> {
  let query = supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (subcategoryId) {
    query = query.eq('subcategory_id', subcategoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Tag[];
}

// Fetch category-level tags (tags tied directly to a category with no subcategory)
export async function getTagsByCategory(userId: string, categoryId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .is('subcategory_id', null)
    .order('name');
  if (error) throw error;
  return (data || []) as Tag[];
}

// Fetch tags for multiple subcategories in a single round-trip
export async function getTagsForSubcategories(userId: string, subcategoryIds: string[]): Promise<Tag[]> {
  if (!subcategoryIds || subcategoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .in('subcategory_id', subcategoryIds)
    .order('name');
  if (error) throw error;
  return (data || []) as Tag[];
}

// Legacy arrays: Get unique Learning.tags for a specific category (via learning_categories)
export async function getLearningTagsByCategory(userId: string, categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('learning')
    .select(`
      tags,
      learning_categories!inner(
        category_id
      )
    `)
    .eq('user_id', userId)
    .eq('learning_categories.category_id', categoryId);
  if (error) throw error;
  const set = new Set<string>();
  (data || []).forEach((row: any) => {
    (row.tags || []).forEach((t: string) => {
      if (t && typeof t === 'string' && t.trim()) set.add(t.trim());
    });
  });
  return Array.from(set).sort();
}

// Legacy arrays: Get unique Resources.tags for a specific category (via resource_categories)
export async function getResourceTagsByCategory(userId: string, categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      tags,
      resource_categories!inner(
        category_id
      )
    `)
    .eq('user_id', userId)
    .eq('resource_categories.category_id', categoryId);
  if (error) throw error;
  const set = new Set<string>();
  (data || []).forEach((row: any) => {
    (row.tags || []).forEach((t: string) => {
      if (t && typeof t === 'string' && t.trim()) set.add(t.trim());
    });
  });
  return Array.from(set).sort();
}

export async function createTag(input: { user_id: string; subcategory_id?: string; category_id?: string; name: string; description?: string; }): Promise<Tag> {
  // Validate association: allow either subcategory_id OR category_id
  const payload: any = { ...input };
  if (!payload.subcategory_id && !payload.category_id) {
    throw new Error('Either subcategory_id or category_id must be provided when creating a tag');
  }
  // If both provided, prefer subcategory mode and drop category_id to avoid ambiguity
  if (payload.subcategory_id && payload.category_id) {
    delete payload.category_id;
  }
  // If description is empty, omit it to avoid PostgREST schema cache issues on legacy DBs
  if (payload.description === '' || payload.description === undefined) {
    delete payload.description;
  }

  const { data, error } = await supabase
    .from('tags')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'description'>>): Promise<Tag> {
  const clean: any = {};
  if (updates.name !== undefined) clean.name = updates.name;
  if (updates.description !== undefined && updates.description !== '') clean.description = updates.description;

  const { data, error } = await supabase
    .from('tags')
    .update(clean)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Upsert helpers
export async function upsertSubcategoriesByNames(userId: string, categoryId: string, names: string[]): Promise<Subcategory[]> {
  const uniqueNames = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) return [];

  const rows = uniqueNames.map(name => ({ user_id: userId, category_id: categoryId, name }));
  const { data, error } = await supabase
    .from('subcategories')
    .upsert(rows, { onConflict: 'user_id,category_id,name' })
    .select('*');
  if (error) throw error;
  return (data || []) as Subcategory[];
}

export async function upsertTagsByNames(userId: string, subcategoryId: string, names: string[]): Promise<Tag[]> {
  const uniqueNames = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) return [];

  const rows = uniqueNames.map(name => ({ user_id: userId, subcategory_id: subcategoryId, name }));
  const { data, error } = await supabase
    .from('tags')
    .upsert(rows, { onConflict: 'user_id,subcategory_id,name' })
    .select('*');
  if (error) throw error;
  return (data || []) as Tag[];
}

// Upsert category-level tags by names (no subcategory)
export async function upsertCategoryTagsByNames(userId: string, categoryId: string, names: string[]): Promise<Tag[]> {
  const uniqueNames = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) return [];

  const rows = uniqueNames.map(name => ({ user_id: userId, category_id: categoryId, name }));
  
  try {
    const { data, error } = await supabase
      .from('tags')
      .upsert(rows, { 
        onConflict: 'user_id,name',
        ignoreDuplicates: false 
      })
      .select('*');
    
    if (error) {
      // Handle duplicate key constraint specifically
      if (error.code === '23505') {
        console.warn('Some tags already exist, fetching existing tags instead');
        // Fetch existing tags that match the names
        const { data: existingData, error: fetchError } = await supabase
          .from('tags')
          .select('*')
          .eq('user_id', userId)
          .eq('category_id', categoryId)
          .in('name', uniqueNames);
        
        if (fetchError) throw fetchError;
        return (existingData || []) as Tag[];
      }
      throw error;
    }
    
    return (data || []) as Tag[];
  } catch (error: any) {
    // Additional fallback for constraint violations
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      console.warn('Duplicate key constraint, fetching existing tags');
      const { data: existingData, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .in('name', uniqueNames);
      
      if (fetchError) throw fetchError;
      return (existingData || []) as Tag[];
    }
    throw error;
  }
}

// Junction setters for learning/resources
export async function setLearningSubcategories(learningId: string, subcategoryIds: string[]): Promise<void> {
  // Clear existing links
  await supabase.from('learning_subcategories').delete().eq('learning_id', learningId);
  const unique = Array.from(new Set(subcategoryIds));
  if (unique.length === 0) return;
  const rows = unique.map(id => ({ learning_id: learningId, subcategory_id: id }));
  const { error } = await supabase.from('learning_subcategories').insert(rows);
  if (error) throw error;
}

export async function setResourceSubcategories(resourceId: string, subcategoryIds: string[]): Promise<void> {
  await supabase.from('resource_subcategories').delete().eq('resource_id', resourceId);
  const unique = Array.from(new Set(subcategoryIds));
  if (unique.length === 0) return;
  const rows = unique.map(id => ({ resource_id: resourceId, subcategory_id: id }));
  const { error } = await supabase.from('resource_subcategories').insert(rows);
  if (error) throw error;
}

export async function setLearningTags(learningId: string, tagIds: string[]): Promise<void> {
  await supabase.from('learning_tags').delete().eq('learning_id', learningId);
  const unique = Array.from(new Set(tagIds));
  if (unique.length === 0) return;
  const rows = unique.map(id => ({ learning_id: learningId, tag_id: id }));
  const { error } = await supabase.from('learning_tags').insert(rows);
  if (error) throw error;
}

export async function setResourceTags(resourceId: string, tagIds: string[]): Promise<void> {
  await supabase.from('resource_tags').delete().eq('resource_id', resourceId);
  const unique = Array.from(new Set(tagIds));
  if (unique.length === 0) return;
  const rows = unique.map(id => ({ resource_id: resourceId, tag_id: id }));
  const { error } = await supabase.from('resource_tags').insert(rows);
  if (error) throw error;
}

function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Sticky Notes Types
export interface StickyNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';
  position_x: number;
  position_y: number;
  is_completed: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface StickyNoteStats {
  total_notes: number;
  completed_notes: number;
  pending_notes: number;
  pinned_notes: number;
  notes_by_color: {
    yellow: number;
    pink: number;
    blue: number;
    green: number;
    purple: number;
    orange: number;
  };
}

// Sticky Notes CRUD Functions
export async function getStickyNotes(): Promise<StickyNote[]> {
  const { data, error } = await supabase
    .from('sticky_notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getStickyNote(id: string): Promise<StickyNote | null> {
  const { data, error } = await supabase
    .from('sticky_notes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createStickyNote(note: Omit<StickyNote, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<StickyNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('sticky_notes')
    .insert([{
      ...note,
      user_id: user.id
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStickyNote(id: string, updates: Partial<StickyNote>): Promise<StickyNote> {
  const { data, error } = await supabase
    .from('sticky_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStickyNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('sticky_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleStickyNoteComplete(id: string): Promise<StickyNote> {
  const { data: currentNote } = await supabase
    .from('sticky_notes')
    .select('is_completed')
    .eq('id', id)
    .single();

  if (!currentNote) throw new Error('Note not found');

  const { data, error } = await supabase
    .from('sticky_notes')
    .update({ is_completed: !currentNote.is_completed })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleStickyNotePin(id: string): Promise<StickyNote> {
  const { data: currentNote } = await supabase
    .from('sticky_notes')
    .select('is_pinned')
    .eq('id', id)
    .single();

  if (!currentNote) throw new Error('Note not found');

  const { data, error } = await supabase
    .from('sticky_notes')
    .update({ is_pinned: !currentNote.is_pinned })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getStickyNotesStats(): Promise<StickyNoteStats> {
  const { data, error } = await supabase
    .rpc('get_sticky_notes_stats');

  if (error) throw error;
  return data?.[0] || {
    total_notes: 0,
    completed_notes: 0,
    pending_notes: 0,
    pinned_notes: 0,
    notes_by_color: {
      yellow: 0,
      pink: 0,
      blue: 0,
      green: 0,
      purple: 0,
      orange: 0
    }
  };
}
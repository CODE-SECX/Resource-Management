import { supabase } from "../lib/supabase";
import type { GlobalSearchResults } from "../types/search";

const SEARCH_LIMIT = 10;

export async function searchResourcesAndLearning(
  userId: string,
  query: string
): Promise<GlobalSearchResults> {
  const safeQuery = query.trim();

  if (!safeQuery) {
    return { resources: [], learning: [] };
  }

  const [resourcesResponse, learningResponse] = await Promise.all([
    supabase
      .from("resources")
      .select("id, title, description, url, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,url.ilike.%${safeQuery}%`)
      .limit(SEARCH_LIMIT),
    supabase
      .from("learning")
      .select("id, title, description, url, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,url.ilike.%${safeQuery}%`)
      .limit(SEARCH_LIMIT),
  ]);

  return {
    resources: resourcesResponse.data ?? [],
    learning: learningResponse.data ?? [],
  };
}

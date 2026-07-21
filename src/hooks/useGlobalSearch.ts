import { useEffect, useState } from "react";
import { searchResourcesAndLearning } from "../services/searchService";
import type { GlobalSearchResults } from "../types/search";

const EMPTY_RESULTS: GlobalSearchResults = { resources: [], learning: [] };

interface UseGlobalSearchOptions {
  userId?: string;
  query: string;
  debounceMs?: number;
}

export function useGlobalSearch({
  userId,
  query,
  debounceMs = 300,
}: UseGlobalSearchOptions) {
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const safeQuery = query.trim();

    if (!userId || !safeQuery) {
      setResults(EMPTY_RESULTS);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const searchResults = await searchResourcesAndLearning(userId, safeQuery);
        setResults(searchResults);
      } catch {
        setResults(EMPTY_RESULTS);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, query, userId]);

  return {
    results,
    isSearching,
    hasQuery: query.trim().length > 0,
  };
}

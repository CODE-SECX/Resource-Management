export interface SearchResultItem {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  created_at: string;
}

export interface GlobalSearchResults {
  resources: SearchResultItem[];
  learning: SearchResultItem[];
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Resource } from '../lib/supabase';

export function useResourcesData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['resources', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_categories(
            categories(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching resources:', error);
        throw error;
      }

      return data?.map((item: any) => ({
        ...item,
        categories: item.resource_categories.map((rc: any) => rc.categories),
      })) as Resource[];
    },
    enabled: !!user,
  });
}

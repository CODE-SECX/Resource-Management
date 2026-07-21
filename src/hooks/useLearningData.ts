import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Learning } from '../lib/supabase';

export function useLearningData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['learning', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('learning')
        .select(`
          *,
          learning_categories(
            categories(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching learning:', error);
        throw error;
      };

      return data?.map((item: any) => ({
        ...item,
        categories: item.learning_categories.map((lc: any) => lc.categories),
      })) as Learning[];
    },
    enabled: !!user,
  });
}

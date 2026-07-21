import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, GraduationCap, Tag, Clock, ArrowRight, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '../components/ui/Skeleton';

interface Stats {
  totalResources: number;
  totalLearning: number;
  totalCategories: number;
  recentItems: number;
}

interface RecentResource {
  id: string;
  title: string;
  created_at: string;
}

interface RecentLearning {
  id: string;
  title: string;
  difficulty_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalResources: 0,
    totalLearning: 0,
    totalCategories: 0,
    recentItems: 0,
  });
  const [recentResources, setRecentResources] = useState<RecentResource[]>([]);
  const [recentLearning, setRecentLearning] = useState<RecentLearning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [resourcesResult, learningResult, categoriesResult] = await Promise.all([
        supabase.from('resources').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('learning').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('categories').select('id', { count: 'exact' }).eq('user_id', user.id),
      ]);

      const { data: recentResourcesData } = await supabase
        .from('resources')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentLearningData } = await supabase
        .from('learning')
        .select('id, title, difficulty_level, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const totalResources = resourcesResult.count || 0;
      const totalLearning = learningResult.count || 0;
      const totalCategories = categoriesResult.count || 0;

      setStats({
        totalResources,
        totalLearning,
        totalCategories,
        recentItems: totalResources + totalLearning,
      });

      setRecentResources(recentResourcesData || []);
      setRecentLearning(recentLearningData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-success/15 text-success border-success/30';
      case 'Intermediate': return 'bg-primary/15 text-primary border-primary/30';
      case 'Advanced': return 'bg-warning/15 text-warning border-warning/30';
      case 'Expert': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Header skeleton */}
          <Skeleton className="h-40 sm:h-56 w-full rounded-2xl" />

          {/* Stats grid skeleton */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-xl bg-card border border-border p-6 shadow-card space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12" rounded="lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Lists skeleton */}
          <div className="grid gap-6 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="rounded-xl bg-card border border-border shadow-card">
                <div className="border-b border-border px-6 py-6">
                  <Skeleton className="h-5 w-40" />
                </div>
                <div className="p-6 space-y-4">
                  {Array.from({ length: 4 }).map((__, rowIdx) => (
                    <div key={rowIdx} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10" rounded="lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 px-6 py-10 sm:px-8 sm:py-16 shadow-modal">
          <div className="relative z-10 max-w-4xl">
            <div className="flex items-center mb-4">
              <Activity className="h-8 w-8 text-primary-foreground/80 mr-3" />
              <span className="text-primary-foreground/80 font-medium text-sm uppercase tracking-wider">Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold text-primary-foreground sm:text-4xl lg:text-5xl mb-4">
              Welcome back, {user?.user_metadata?.name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-lg text-primary-foreground/80 sm:text-xl max-w-3xl leading-relaxed">
              Here's an overview of your knowledge collection and learning progress.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Total Resources', value: stats.totalResources, icon: BookOpen, link: '/resources' },
            { title: 'Learning Items', value: stats.totalLearning, icon: GraduationCap, link: '/learning' },
            { title: 'Categories', value: stats.totalCategories, icon: Tag, link: '/categories' },
            { title: 'Recent Items', value: stats.recentItems, icon: Clock },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-xl bg-card border border-border p-6 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                  <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-1">{stat.value}</p>
                  {stat.link && (
                    <div className="mt-3">
                      <Link
                        to={stat.link}
                        className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-150"
                      >
                        View all
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors duration-200">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Resources + Learning */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Resources */}
          <div className="overflow-hidden rounded-xl bg-card border border-border shadow-card">
            <div className="border-b border-border px-6 py-6 flex justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Recent Resources
              </h2>
              <Link to="/resources" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-150">
                View all
              </Link>
            </div>
            <div className="p-6">
              {recentResources.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentResources.map(r => (
                    <div key={r.id} className="flex items-center space-x-4 rounded-lg p-3 hover:bg-accent/50 transition-colors duration-150">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">No resources yet</div>
              )}
            </div>
          </div>

          {/* Learning */}
          <div className="overflow-hidden rounded-xl bg-card border border-border shadow-card">
            <div className="border-b border-border px-6 py-6 flex justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-success" /> Recent Learning
              </h2>
              <Link to="/learning" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-150">
                View all
              </Link>
            </div>
            <div className="p-6">
              {recentLearning.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {recentLearning.map(item => (
                    <div key={item.id} className="flex items-center space-x-4 rounded-lg p-3 hover:bg-accent/50 transition-colors duration-150">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                          <GraduationCap className="h-4 w-4 text-success" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(item.difficulty_level)}`}>
                            {item.difficulty_level}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">No learning items yet</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

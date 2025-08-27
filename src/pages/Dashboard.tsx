import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, GraduationCap, Tag, TrendingUp, Clock, Star, Plus, ArrowRight, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

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
      case 'Beginner': return 'bg-emerald-700/30 text-emerald-300 border-emerald-600';
      case 'Intermediate': return 'bg-blue-700/30 text-blue-300 border-blue-600';
      case 'Advanced': return 'bg-amber-700/30 text-amber-300 border-amber-600';
      case 'Expert': return 'bg-red-700/30 text-red-300 border-red-600';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-indigo-500"></div>
          <p className="text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-purple-800 px-6 py-10 sm:px-8 sm:py-16 shadow-2xl">
          <div className="relative z-10 max-w-4xl">
            <div className="flex items-center mb-4">
              <Activity className="h-8 w-8 text-indigo-200 mr-3" />
              <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider">Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl mb-4">
              Welcome back, {user?.user_metadata?.name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-lg text-indigo-200 sm:text-xl max-w-3xl leading-relaxed">
              Here's an overview of your knowledge collection and learning progress.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Total Resources', value: stats.totalResources, icon: BookOpen, link: '/resources' },
            { title: 'Learning Items', value: stats.totalLearning, icon: GraduationCap, link: '/learning' },
            { title: 'Categories', value: stats.totalCategories, icon: Tag, link: '/categories' },
            { title: 'Recent Items', value: stats.recentItems, icon: Clock },
          ].map((stat, idx) => (
            <div key={idx} className="group relative overflow-hidden rounded-xl bg-slate-800 border border-slate-700 p-6 shadow-md hover:shadow-lg hover:border-indigo-500/50 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{stat.title}</p>
                  <p className="text-3xl sm:text-4xl font-bold text-slate-100 mt-2 mb-1">{stat.value}</p>
                  {stat.link && (
                    <div className="mt-3">
                      <Link to={stat.link} className="inline-flex items-center text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                        View all
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 p-3 rounded-xl bg-slate-700 group-hover:bg-slate-600 transition-colors">
                  <stat.icon className="h-6 w-6 text-indigo-300" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Resources + Learning */}
        <div className="grid gap-8 xl:grid-cols-2">
          {/* Resources */}
          <div className="overflow-hidden rounded-xl bg-slate-800 border border-slate-700 shadow-md">
            <div className="border-b border-slate-700 px-6 py-6 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-400" /> Recent Resources</h2>
              <Link to="/resources" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">View all</Link>
            </div>
            <div className="p-6">
              {recentResources.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {recentResources.map(r => (
                    <div key={r.id} className="flex items-center space-x-4 rounded-lg p-3 hover:bg-slate-700/50 transition-all duration-200">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700">
                          <BookOpen className="h-4 w-4 text-indigo-300" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{r.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">No resources yet</div>
              )}
            </div>
          </div>

          {/* Learning */}
          <div className="overflow-hidden rounded-xl bg-slate-800 border border-slate-700 shadow-md">
            <div className="border-b border-slate-700 px-6 py-6 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-emerald-400" /> Recent Learning</h2>
              <Link to="/learning" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">View all</Link>
            </div>
            <div className="p-6">
              {recentLearning.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {recentLearning.map(item => (
                    <div key={item.id} className="flex items-center space-x-4 rounded-lg p-3 hover:bg-slate-700/50 transition-all duration-200">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700">
                          <GraduationCap className="h-4 w-4 text-emerald-300" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{item.title}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(item.difficulty_level)}`}>
                            {item.difficulty_level}
                          </span>
                          <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">No learning items yet</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

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

      // Fetch stats
      const [resourcesResult, learningResult, categoriesResult] = await Promise.all([
        supabase
          .from('resources')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('learning')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabase
          .from('categories')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
      ]);

      // Fetch recent resources
      const { data: recentResourcesData } = await supabase
        .from('resources')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent learning
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

  const statCards = [
    {
      title: 'Total Resources',
      value: stats.totalResources,
      icon: BookOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      link: '/resources',
    },
    {
      title: 'Learning Items',
      value: stats.totalLearning,
      icon: GraduationCap,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      link: '/learning',
    },
    {
      title: 'Categories',
      value: stats.totalCategories,
      icon: Tag,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      link: '/categories',
    },
    {
      title: 'Recent Items',
      value: stats.recentItems,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100',
    },
  ];

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Advanced': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Expert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const quickActions = [
    {
      title: 'Add Resource',
      description: 'Create new resource',
      icon: BookOpen,
      href: '/resources?action=new',
      color: 'border-blue-300 hover:border-blue-400 hover:bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900',
      descColor: 'text-blue-700',
    },
    {
      title: 'Add Learning',
      description: 'Track your progress',
      icon: GraduationCap,
      href: '/learning?action=new',
      color: 'border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-900',
      descColor: 'text-emerald-700',
    },
    {
      title: 'Add Category',
      description: 'Organize content',
      icon: Tag,
      href: '/categories?action=new',
      color: 'border-purple-300 hover:border-purple-400 hover:bg-purple-50',
      iconColor: 'text-purple-600',
      textColor: 'text-purple-900',
      descColor: 'text-purple-700',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-6 py-10 sm:px-8 sm:py-16 shadow-2xl">
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center mb-4">
            <Activity className="h-8 w-8 text-indigo-200 mr-3" />
            <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl mb-4">
            Welcome back, {user?.user_metadata?.name || user?.email?.split('@')[0]}!
          </h1>
          <p className="text-lg text-indigo-100 sm:text-xl max-w-3xl leading-relaxed">
            Here's an overview of your knowledge collection and learning progress.
          </p>
        </div>
        {/* Decorative background pattern */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 sm:h-56 sm:w-56" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/5 sm:h-48 sm:w-48" />
        <div className="absolute top-1/2 right-1/4 h-24 w-24 rounded-full bg-white/5" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-lg ring-1 ring-gray-900/5 transition-all duration-300 hover:shadow-xl hover:ring-gray-900/10 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-600 truncate uppercase tracking-wide">
                  {stat.title}
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-1">
                  {stat.value}
                </p>
                {stat.link && (
                  <div className="mt-3">
                    <Link
                      to={stat.link}
                      className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 group-hover:translate-x-1 transition-all duration-200"
                    >
                      View all
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
              <div className={`flex-shrink-0 p-3 rounded-xl ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-8 xl:grid-cols-2">
        {/* Recent Resources */}
        <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Resources
                </h2>
              </div>
              <Link
                to="/resources"
                className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentResources.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {recentResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="group flex items-center space-x-4 rounded-lg p-3 transition-all duration-200 hover:bg-blue-50 hover:shadow-md"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-900">
                        {resource.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        {new Date(resource.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No resources yet</p>
                <p className="text-xs text-gray-400 mb-4">Create your first resource to get started</p>
                <Link
                  to="/resources?action=new"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Resource
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Learning */}
        <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <GraduationCap className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Recent Learning
                </h2>
              </div>
              <Link
                to="/learning"
                className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentLearning.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {recentLearning.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center space-x-4 rounded-lg p-3 transition-all duration-200 hover:bg-emerald-50 hover:shadow-md"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                        <GraduationCap className="h-4 w-4 text-emerald-600" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-emerald-900">
                        {item.title}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(
                            item.difficulty_level
                          )}`}
                        >
                          {item.difficulty_level}
                        </span>
                        <p className="text-xs text-gray-500 font-medium">
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No learning items yet</p>
                <p className="text-xs text-gray-400 mb-4">Add your first learning item to track progress</p>
                <Link
                  to="/learning?action=new"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Learning
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-900/5">
        <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-6">
          <h2 className="flex items-center text-base font-semibold text-gray-900 sm:text-lg">
            <Star className="mr-3 h-6 w-6 text-amber-500" />
            Quick Actions
          </h2>
        </div>
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.href}
                className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 hover:scale-105 hover:shadow-lg ${action.color}`}
              >
                <action.icon className={`mx-auto h-10 w-10 transition-transform group-hover:scale-125 ${action.iconColor}`} />
                <p className={`mt-3 text-base font-semibold ${action.textColor}`}>{action.title}</p>
                <p className={`mt-2 text-sm ${action.descColor}`}>{action.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
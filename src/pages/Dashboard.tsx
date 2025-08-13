import React, { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, Tag, TrendingUp, Clock, Star, Home, Menu, X } from 'lucide-react';

// Mock auth context and supabase for demo
const useAuth = () => ({ 
  user: { 
    user_metadata: { name: 'John Doe' }, 
    email: 'john@example.com' 
  } 
});

interface Stats {
  totalResources: number;
  totalLearning: number;
  totalCategories: number;
  recentItems: number;
}

const mockStats: Stats = {
  totalResources: 24,
  totalLearning: 18,
  totalCategories: 8,
  recentItems: 12,
};

const mockRecentResources = [
  { id: 1, title: 'React Best Practices Guide', created_at: '2025-08-10' },
  { id: 2, title: 'JavaScript ES6 Features', created_at: '2025-08-09' },
  { id: 3, title: 'CSS Grid Layout Mastery', created_at: '2025-08-08' },
  { id: 4, title: 'Node.js Performance Tips', created_at: '2025-08-07' },
  { id: 5, title: 'Database Design Principles', created_at: '2025-08-06' },
];

const mockRecentLearning = [
  { id: 1, title: 'Advanced TypeScript', difficulty_level: 'Advanced', created_at: '2025-08-11' },
  { id: 2, title: 'React Hooks Deep Dive', difficulty_level: 'Intermediate', created_at: '2025-08-10' },
  { id: 3, title: 'Git Fundamentals', difficulty_level: 'Beginner', created_at: '2025-08-09' },
  { id: 4, title: 'System Design Basics', difficulty_level: 'Expert', created_at: '2025-08-08' },
  { id: 5, title: 'API Development', difficulty_level: 'Intermediate', created_at: '2025-08-07' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>(mockStats);
  const [recentResources, setRecentResources] = useState(mockRecentResources);
  const [recentLearning, setRecentLearning] = useState(mockRecentLearning);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const navigationItems = [
    { name: 'Dashboard', icon: Home, href: '/', current: true },
    { name: 'Resources', icon: BookOpen, href: '/resources', current: false },
    { name: 'Learning', icon: GraduationCap, href: '/learning', current: false },
    { name: 'Categories', icon: Tag, href: '/categories', current: false },
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
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 border-r border-gray-200">
          <div className="flex h-16 shrink-0 items-center border-b border-gray-100">
            <h1 className="text-xl font-bold text-indigo-600">Knowledge Hub</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-2">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={`group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-all duration-200 ${
                      item.current
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${
                        item.current ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'
                      }`}
                    />
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className={`relative z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-y-0 left-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-indigo-600">Knowledge Hub</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="mt-6">
            <ul className="space-y-2">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={`group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium transition-all duration-200 ${
                      item.current
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${
                        item.current ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'
                      }`}
                    />
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2.5 text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        </div>

        {/* Page content */}
        <main className="py-6 sm:py-8 lg:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* Welcome Header */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-6 py-8 sm:px-8 sm:py-10">
                <div className="relative z-10">
                  <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                    Welcome back, {user?.user_metadata?.name || user?.email?.split('@')[0]}!
                  </h1>
                  <p className="mt-3 text-base text-indigo-100 sm:text-lg max-w-2xl">
                    Here's an overview of your knowledge collection and learning progress.
                  </p>
                </div>
                {/* Decorative background pattern */}
                <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 sm:h-40 sm:w-40" />
                <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5 sm:h-32 sm:w-32" />
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, index) => (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-lg bg-white p-4 sm:p-6 shadow-sm ring-1 ring-gray-900/5 transition-all duration-200 hover:shadow-md hover:ring-gray-900/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                          {stat.title}
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`flex-shrink-0 p-2 sm:p-3 rounded-lg ${stat.iconBg}`}>
                        <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                      </div>
                    </div>
                    {stat.link && (
                      <div className="mt-3 sm:mt-4">
                        <a
                          href={stat.link}
                          className="inline-flex items-center text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 group-hover:translate-x-1 transition-all duration-200"
                        >
                          View all
                          <TrendingUp className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="grid gap-6 lg:gap-8 xl:grid-cols-2">
                {/* Recent Resources */}
                <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
                  <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-5 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                          Recent Resources
                        </h2>
                      </div>
                      <a
                        href="/resources"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View all
                      </a>
                    </div>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    {recentResources.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentResources.map((resource) => (
                          <div
                            key={resource.id}
                            className="group flex items-center space-x-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
                          >
                            <div className="flex-shrink-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                                <BookOpen className="h-4 w-4 text-blue-600" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {resource.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
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
                      <div className="text-center py-12">
                        <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No resources yet</p>
                        <p className="text-xs text-gray-400">Create your first resource to get started</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Learning */}
                <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
                  <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-5 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                            <GraduationCap className="h-4 w-4 text-emerald-600" />
                          </div>
                        </div>
                        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                          Recent Learning
                        </h2>
                      </div>
                      <a
                        href="/learning"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View all
                      </a>
                    </div>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    {recentLearning.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentLearning.map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-center space-x-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
                          >
                            <div className="flex-shrink-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                <GraduationCap className="h-4 w-4 text-emerald-600" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {item.title}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getDifficultyColor(
                                    item.difficulty_level
                                  )}`}
                                >
                                  {item.difficulty_level}
                                </span>
                                <p className="text-xs text-gray-500">
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
                      <div className="text-center py-12">
                        <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
                        <p className="mt-2 text-sm text-gray-500">No learning items yet</p>
                        <p className="text-xs text-gray-400">Add your first learning item to track progress</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
                <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-5 sm:px-6">
                  <h2 className="flex items-center text-base font-semibold text-gray-900 sm:text-lg">
                    <Star className="mr-3 h-5 w-5 text-amber-500" />
                    Quick Actions
                  </h2>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <a
                      href="/resources?action=new"
                      className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-300 p-6 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50"
                    >
                      <BookOpen className="mx-auto h-8 w-8 text-blue-600 transition-transform group-hover:scale-110" />
                      <p className="mt-2 text-sm font-medium text-blue-900">Add Resource</p>
                      <p className="mt-1 text-xs text-blue-700">Create new resource</p>
                    </a>
                    <a
                      href="/learning?action=new"
                      className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 p-6 text-center transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50"
                    >
                      <GraduationCap className="mx-auto h-8 w-8 text-emerald-600 transition-transform group-hover:scale-110" />
                      <p className="mt-2 text-sm font-medium text-emerald-900">Add Learning</p>
                      <p className="mt-1 text-xs text-emerald-700">Track your progress</p>
                    </a>
                    <a
                      href="/categories?action=new"
                      className="group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-300 p-6 text-center transition-all duration-200 hover:border-purple-400 hover:bg-purple-50 sm:col-span-2 lg:col-span-1"
                    >
                      <Tag className="mx-auto h-8 w-8 text-purple-600 transition-transform group-hover:scale-110" />
                      <p className="mt-2 text-sm font-medium text-purple-900">Add Category</p>
                      <p className="mt-1 text-xs text-purple-700">Organize content</p>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
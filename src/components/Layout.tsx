import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Home, 
  BookOpen, 
  GraduationCap, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Search,
  Target,
  StickyNote,
  Tag
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ resources: any[]; learning: any[] }>({ resources: [], learning: [] });

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ resources: [], learning: [] });
  }, [location]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Resources', href: '/resources', icon: BookOpen },
    { name: 'Resource Index', href: '/resources/index', icon: BookOpen },
    { name: 'Learning', href: '/learning', icon: GraduationCap },
    { name: 'Learning Index', href: '/learning/index', icon: GraduationCap },
    { name: 'Payload Arsenal', href: '/payloads', icon: Target },
    { name: 'Sticky Notes', href: '/sticky-notes', icon: StickyNote },
    { name: 'Taxonomy', href: '/taxonomy', icon: Tag },
    { name: 'Categories', href: '/categories', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  // Debounced global search
  useEffect(() => {
    if (!user) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ resources: [], learning: [] });
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const [resResources, resLearning] = await Promise.all([
          supabase
            .from('resources')
            .select('id, title, description, url, created_at')
            .eq('user_id', user.id)
            .or(`title.ilike.%${q}%,description.ilike.%${q}%,url.ilike.%${q}%`)
            .limit(10),
          supabase
            .from('learning')
            .select('id, title, description, url, created_at')
            .eq('user_id', user.id)
            .or(`title.ilike.%${q}%,description.ilike.%${q}%,url.ilike.%${q}%`)
            .limit(10)
        ]);

        setSearchResults({
          resources: resResources.data || [],
          learning: resLearning.data || []
        });
      } catch (e) {
        setSearchResults({ resources: [], learning: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header with gradient background */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2 group">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  ResourceHub
                </span>
              </Link>
              
              {/* Desktop navigation removed in favor of universal toggle menu */}
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* Global Search */}
              <div className="relative hidden sm:block">
                <div className="flex items-center bg-gray-800 border border-gray-700 px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all duration-200">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search resources & learning..."
                    className="bg-transparent text-sm text-gray-200 placeholder:text-gray-500 px-3 py-1 w-64 focus:outline-none border-none"
                  />
                </div>
                {searchOpen && (searchQuery || isSearching) && (
                  <div className="absolute right-0 mt-2 w-[28rem] max-h-96 overflow-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Search results</span>
                      <button className="text-xs text-gray-400 hover:text-gray-200" onClick={() => setSearchOpen(false)}>Close</button>
                    </div>
                    {isSearching && (
                      <div className="p-4 text-sm text-gray-400">Searching...</div>
                    )}
                    {!isSearching && (
                      <div className="p-2 space-y-3">
                        <div>
                          <div className="px-2 py-1 text-xs font-semibold text-gray-400">Resources</div>
                          {searchResults.resources.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                          )}
                          {searchResults.resources.map((r) => (
                            <Link
                              key={r.id}
                              to={`/resources/${r.id}`}
                              onClick={() => setSearchOpen(false)}
                              className="block px-3 py-2 hover:bg-gray-700"
                            >
                              <div className="text-gray-200 text-sm font-medium line-clamp-1">{r.title}</div>
                              {r.url && (
                                <div className="text-xs text-indigo-400 line-clamp-1">{r.url}</div>
                              )}
                            </Link>
                          ))}
                        </div>
                        <div>
                          <div className="px-2 py-1 text-xs font-semibold text-gray-400">Learning</div>
                          {searchResults.learning.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                          )}
                          {searchResults.learning.map((l) => (
                            <Link
                              key={l.id}
                              to={`/learning/${l.id}`}
                              onClick={() => setSearchOpen(false)}
                              className="block px-3 py-2 hover:bg-gray-700"
                            >
                              <div className="text-gray-200 text-sm font-medium line-clamp-1">{l.title}</div>
                              {l.url && (
                                <div className="text-xs text-indigo-400 line-clamp-1">{l.url}</div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>


              {/* User menu */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm text-gray-200">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Menu button (visible on all screens) */}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Collapsible menu (all screens, full-width dropdown) */}
        <div className={`${isMobileMenuOpen ? '' : 'hidden'}`}>
          <div className="px-4 pt-2 pb-4 space-y-2 bg-gray-800/50 border-t border-gray-700 z-40">
            {/* Mobile Search */}
            <div className="relative sm:hidden">
              <div className="flex items-center bg-gray-800 border border-gray-700 px-2 focus-within:ring-2 focus-within:ring-indigo-500">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search resources & learning..."
                  className="bg-transparent text-sm text-gray-200 placeholder:text-gray-500 px-2 py-1.5 w-full focus:outline-none border-none"
                />
              </div>
              {searchOpen && (searchQuery || isSearching) && (
                <div className="absolute left-0 right-0 mt-2 w-full max-h-96 overflow-auto bg-gray-800 border border-gray-700 shadow-xl z-50">
                  <div className="p-2 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Search results</span>
                    <button className="text-xs text-gray-400 hover:text-gray-200" onClick={() => setSearchOpen(false)}>Close</button>
                  </div>
                  {isSearching && (
                    <div className="p-4 text-sm text-gray-400">Searching...</div>
                  )}
                  {!isSearching && (
                    <div className="p-2 space-y-3">
                      <div>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-400">Resources</div>
                        {searchResults.resources.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                        )}
                        {searchResults.resources.map((r) => (
                          <Link
                            key={r.id}
                            to={`/resources/${r.id}`}
                            onClick={() => setSearchOpen(false)}
                            className="block px-3 py-2 rounded-md hover:bg-gray-700"
                          >
                            <div className="text-gray-200 text-sm font-medium line-clamp-1">{r.title}</div>
                            {r.url && (
                              <div className="text-xs text-indigo-400 line-clamp-1">{r.url}</div>
                            )}
                          </Link>
                        ))}
                      </div>
                      <div>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-400">Learning</div>
                        {searchResults.learning.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                        )}
                        {searchResults.learning.map((l) => (
                          <Link
                            key={l.id}
                            to={`/learning/${l.id}`}
                            onClick={() => setSearchOpen(false)}
                            className="block px-3 py-2 hover:bg-gray-700"
                          >
                            <div className="text-gray-200 text-sm font-medium line-clamp-1">{l.title}</div>
                            {l.url && (
                              <div className="text-xs text-indigo-400 line-clamp-1">{l.url}</div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <MobileNavLink key={item.name} to={item.href} className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </MobileNavLink>
              );
            })}
            {user && (
              <button
                onClick={handleSignOut}
                className="w-full text-left flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800/50 border-t border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  ResourceHub
                </span>
              </Link>
              <p className="text-gray-400 max-w-md leading-relaxed">
                Your comprehensive platform for learning resources, knowledge management, and educational content.
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">Platform</h3>
              <ul className="space-y-2">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link to={item.href} className="text-gray-400 hover:text-white transition-colors duration-200">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">Contact Us</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} ResourceHub. Built with ❤️ for learners everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// (Desktop NavLink removed; using MobileNavLink for the collapsible menu only)

const MobileNavLink = ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`block px-3 py-2 rounded-lg text-base font-medium transition-all duration-200 ${
        isActive
          ? 'bg-blue-600/20 text-blue-400 border-l-4 border-blue-500'
          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
      } ${className || ''}`}
    >
      {children}
    </Link>
  );
};
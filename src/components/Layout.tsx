import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ui/ThemeToggle';
import {
  Home,
  BookOpen,
  GraduationCap,
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
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ resources: [], learning: [] });
  }, [location]);

  // Prevent body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close the search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Resources', href: '/resources', icon: BookOpen },
    { name: 'Resource Index', href: '/resources/index', icon: BookOpen },
    { name: 'Learning', href: '/learning', icon: GraduationCap },
    { name: 'Learning Index', href: '/learning/index', icon: GraduationCap },
    { name: 'Payload Arsenal', href: '/payloads', icon: Target },
    { name: 'Sticky Notes', href: '/sticky-notes', icon: StickyNote },
    { name: 'Taxonomy', href: '/taxonomy', icon: Tag },
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

  const isActive = (href: string) => location.pathname === href;

  const SearchResultsPanel = () => (
    <div className="p-2 space-y-3">
      <div>
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resources</div>
        {searchResults.resources.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
        )}
        {searchResults.resources.map((r) => (
          <Link
            key={r.id}
            to={`/resources/${r.id}`}
            onClick={() => setSearchOpen(false)}
            className="block rounded-md px-3 py-2 hover:bg-accent transition-colors duration-150"
          >
            <div className="text-foreground text-sm font-medium line-clamp-1">{r.title}</div>
            {r.url && (
              <div className="text-xs text-primary line-clamp-1">{r.url}</div>
            )}
          </Link>
        ))}
      </div>
      <div>
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learning</div>
        {searchResults.learning.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
        )}
        {searchResults.learning.map((l) => (
          <Link
            key={l.id}
            to={`/learning/${l.id}`}
            onClick={() => setSearchOpen(false)}
            className="block rounded-md px-3 py-2 hover:bg-accent transition-colors duration-150"
          >
            <div className="text-foreground text-sm font-medium line-clamp-1">{l.title}</div>
            {l.url && (
              <div className="text-xs text-primary line-clamp-1">{l.url}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <nav className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            {/* Logo and brand */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-sm">
                <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight hidden xs:block">
                ResourceHub
              </span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`nav-link flex items-center gap-1.5 whitespace-nowrap ${isActive(item.href) ? 'active' : ''}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Global Search */}
              <div className="relative hidden sm:block" ref={searchContainerRef}>
                <div className="flex items-center bg-secondary/60 border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-primary transition-all duration-200 w-56 lg:w-64">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search..."
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground px-2 py-0.5 w-full focus:outline-none border-none"
                  />
                </div>
                {searchOpen && (searchQuery || isSearching) && (
                  <div className="absolute right-0 mt-2 w-[28rem] max-w-[90vw] max-h-96 overflow-auto bg-popover border border-border rounded-xl shadow-dropdown z-50 animate-scale-in">
                    <div className="p-2 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Search results</span>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setSearchOpen(false)}>Close</button>
                    </div>
                    {isSearching ? (
                      <div className="p-4 text-sm text-muted-foreground">Searching...</div>
                    ) : (
                      <SearchResultsPanel />
                    )}
                  </div>
                )}
              </div>

              <ThemeToggle />

              {/* User menu */}
              {user && (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
                  <div className="text-right leading-tight">
                    <p className="text-sm text-foreground font-medium max-w-[10rem] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                type="button"
                className="btn-ghost lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile / tablet collapsible menu */}
        <div
          className={`lg:hidden overflow-hidden transition-[max-height,opacity] duration-250 ease-out-soft ${
            isMobileMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pt-3 pb-4 space-y-1 bg-card border-t border-border overflow-y-auto max-h-[calc(100vh-4rem)]">
            {/* Mobile Search */}
            <div className="relative sm:hidden mb-2">
              <div className="flex items-center bg-secondary/60 border border-border rounded-lg px-3 focus-within:ring-2 focus-within:ring-ring/50">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search resources & learning..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground px-2 py-2.5 w-full focus:outline-none border-none"
                />
              </div>
              {searchOpen && (searchQuery || isSearching) && (
                <div className="mt-2 w-full max-h-72 overflow-auto bg-popover border border-border rounded-xl shadow-dropdown z-50">
                  <div className="p-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Search results</span>
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSearchOpen(false)}>Close</button>
                  </div>
                  {isSearching ? (
                    <div className="p-4 text-sm text-muted-foreground">Searching...</div>
                  ) : (
                    <SearchResultsPanel />
                  )}
                </div>
              )}
            </div>

            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <MobileNavLink key={item.name} to={item.href}>
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </MobileNavLink>
              );
            })}

            {user && (
              <div className="pt-2 mt-2 border-t border-border space-y-1">
                <div className="px-3 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 min-h-[44px]"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 max-w-8xl mx-auto w-full">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-1 sm:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground tracking-tight">
                  ResourceHub
                </span>
              </Link>
              <p className="text-muted-foreground max-w-md leading-relaxed text-sm">
                Your comprehensive platform for learning resources, knowledge management, and educational content.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Platform</h3>
              <ul className="space-y-2.5">
                {navigation.slice(0, 5).map((item) => (
                  <li key={item.name}>
                    <Link to={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">Support</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Documentation</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Help Center</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-6 text-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} ResourceHub. Built for learners everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const MobileNavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors duration-150 min-h-[44px] ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </Link>
  );
};

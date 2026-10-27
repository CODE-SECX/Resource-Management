import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ui/ThemeToggle';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  BookOpen,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Search,
  Sparkles,
  StickyNote,
  Star,
  Tag,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
}

const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Favourites', href: '/favourites', icon: Star },
    ],
  },
  {
    label: 'Library',
    items: [
      { name: 'Resources', href: '/resources', icon: BookOpen },
      { name: 'Learning', href: '/learning', icon: GraduationCap },
      { name: 'Notes', href: '/sticky-notes', icon: StickyNote },
    ],
  },
  {
    label: 'Organise',
    items: [{ name: 'Taxonomy', href: '/taxonomy', icon: Tag }],
  },
  {
    label: 'Intelligence',
    items: [
      { name: 'AI Assistant', href: '/ai', icon: Sparkles, badge: 'New' },
      { name: 'Library Organizer', href: '/ai/organize', icon: Wand2, adminOnly: true },
    ],
  },
];

interface SearchHit {
  id: string;
  title: string;
  url: string | null;
}

// A nav item stays highlighted on its sub-pages (e.g. Resources on /resources/123).
function isSectionActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function Logo() {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm transition-transform duration-200 group-hover:scale-105">
        <BookOpen className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="hidden text-lg font-bold tracking-tight text-foreground xs:block">ResourceHub</span>
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const visibleNav = navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || isAdmin) }))
    .filter((group) => group.items.length > 0);
  // Highlight only the most specific match (/ai/organize shouldn't also light up /ai).
  const activeHref = visibleNav
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => isSectionActive(location.pathname, href))
    .sort((a, b) => b.length - a.length)[0];

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ resources: SearchHit[]; learning: SearchHit[] }>({ resources: [], learning: [] });
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close everything on navigation
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ resources: [], learning: [] });
  }, [location.pathname]);

  // Keep the closed drawer out of the tab order / accessibility tree
  // (React 18 has no `inert` prop, so set the attribute directly).
  useEffect(() => {
    drawerRef.current?.toggleAttribute('inert', !menuOpen);
  }, [menuOpen]);

  // Drawer: lock scroll, close on Escape, move focus in and back out
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const menuButton = menuButtonRef.current;
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      menuButton?.focus();
    };
  }, [menuOpen]);

  // Close the search dropdown / user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced global search
  useEffect(() => {
    if (!user) return;
    // Characters with meaning in PostgREST filter syntax would otherwise break
    // (or alter) the `.or()` filter below.
    const term = searchQuery.trim().replace(/[,()"\\%*]/g, ' ').trim();
    if (!term) {
      setSearchResults({ resources: [], learning: [] });
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const [resResources, resLearning] = await Promise.all([
          supabase
            .from('resources')
            .select('id, title, url')
            .eq('user_id', user.id)
            .or(`title.ilike.%${term}%,description.ilike.%${term}%,url.ilike.%${term}%`)
            .limit(6),
          supabase
            .from('learning')
            .select('id, title, url')
            .eq('user_id', user.id)
            .or(`title.ilike.%${term}%,description.ilike.%${term}%,url.ilike.%${term}%`)
            .limit(6),
        ]);
        setSearchResults({ resources: resResources.data || [], learning: resLearning.data || [] });
      } catch {
        setSearchResults({ resources: [], learning: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const askAi = () => navigate(`/ai?q=${encodeURIComponent(searchQuery.trim())}`);

  const renderSearchPanel = () => (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-auto rounded-xl border border-border bg-popover shadow-dropdown animate-scale-in">
      <button
        onClick={askAi}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Ask AI</span>
          <span className="block truncate text-xs text-muted-foreground">“{searchQuery.trim()}” — answered from your library</span>
        </span>
      </button>
      {isSearching ? (
        <div className="p-4 text-sm text-muted-foreground">Searching…</div>
      ) : (
        <div className="space-y-3 p-2">
          {(
            [
              ['Resources', searchResults.resources, '/resources'],
              ['Learning', searchResults.learning, '/learning'],
            ] as const
          ).map(([label, hits, base]) => (
            <div key={label}>
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
              {hits.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>}
              {hits.map((hit) => (
                <Link key={hit.id} to={`${base}/${hit.id}`} className="block rounded-md px-3 py-2 transition-colors duration-150 hover:bg-accent">
                  <div className="line-clamp-1 text-sm font-medium text-foreground">{hit.title}</div>
                  {hit.url && <div className="line-clamp-1 text-xs text-primary">{hit.url}</div>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSearch = (className: string) => (
    <div className={`relative ${className}`} ref={searchContainerRef}>
      <div className="flex items-center rounded-lg border border-border bg-secondary/60 px-3 transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/50">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim()) askAi();
            if (e.key === 'Escape') setSearchOpen(false);
          }}
          placeholder="Search or ask your library…"
          aria-label="Search resources and learning"
          className="w-full border-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        />
      </div>
      {searchOpen && searchQuery.trim() && renderSearchPanel()}
    </div>
  );

  const initial = (user?.user_metadata?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-8xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            className="btn-ghost -ml-2"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="app-drawer"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Logo />

          {renderSearch('mx-auto hidden w-full max-w-xl sm:block')}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
            <Link to="/ai" className="btn-ghost text-primary md:hidden" aria-label="Ask AI">
              <Sparkles className="h-5 w-5" />
            </Link>
            <Link
              to="/ai"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 md:inline-flex"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Link>
            <ThemeToggle />

            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-offset-background transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                >
                  {initial}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-popover p-1 shadow-dropdown animate-scale-in">
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
                    </div>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={signOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation drawer (all screen sizes) */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="app-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-modal transition-transform duration-300 ease-out-soft ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Logo />
          <button className="btn-ghost" onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {visibleNav.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <Icon className={`h-[18px] w-[18px] ${item.href === '/favourites' ? 'text-amber-400' : ''}`} />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Search lives in the drawer on phones (no room in the header) */}
        <div className="border-t border-border p-3 sm:hidden">{menuOpen && renderSearch('w-full')}</div>

        {user && (
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initial}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">{user.email}</p>
              <button onClick={signOut} className="btn-ghost" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-8xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-16">
          <div className="animate-fade-in-up">{children}</div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-8xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} ResourceHub</span>
          <span>Your library, organised — with answers from your own content.</span>
        </div>
      </footer>
    </div>
  );
}

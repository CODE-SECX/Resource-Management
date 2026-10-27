import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

// Pages are code-split so each route only downloads what it needs.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Resources = named(() => import('./pages/Resources'), 'Resources');
const Learning = named(() => import('./pages/Learning'), 'Learning');
const Index = named(() => import('./pages/Index'), 'Index');
const ResourceIndex = named(() => import('./pages/ResourceIndex'), 'ResourceIndex');
const ResourceDetail = named(() => import('./pages/ResourceDetail'), 'ResourceDetail');
const LearningDetail = named(() => import('./pages/LearningDetail'), 'LearningDetail');
const PublicLearning = lazy(() => import('./pages/PublicLearning'));
const PublicResource = lazy(() => import('./pages/PublicResource'));
const StickyNotes = lazy(() => import('./pages/StickyNotes'));
const Taxonomy = lazy(() => import('./pages/Taxonomy'));
const LearningForm = named(() => import('./pages/LearningForm'), 'LearningForm');
const ResourceForm = named(() => import('./pages/ResourceForm'), 'ResourceForm');
const Favourites = named(() => import('./pages/Favourites'), 'Favourites');
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const LibraryOrganizer = lazy(() => import('./pages/LibraryOrganizer'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner h-8 w-8" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <Layout>
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/resources/index" element={<ResourceIndex />} />
            <Route path="/resources/new" element={<ResourceForm />} />
            <Route path="/resources/:id/edit" element={<ResourceForm />} />
            <Route path="/resources/:id" element={<ResourceDetail />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/learning/index" element={<Index />} />
            <Route path="/learning/new" element={<LearningForm />} />
            <Route path="/learning/:id/edit" element={<LearningForm />} />
            <Route path="/learning/:id" element={<LearningDetail />} />
            <Route path="/categories" element={<Navigate to="/taxonomy" replace />} />
            <Route path="/taxonomy" element={<Taxonomy />} />
            <Route path="/sticky-notes" element={<StickyNotes />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/ai" element={<AiAssistant />} />
            <Route path="/ai/organize" element={<LibraryOrganizer />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

// Public routes for shared content (no authentication required)
function PublicRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/learning/:token" element={<PublicLearning />} />
          <Route path="/resource/:token" element={<PublicResource />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: resolvedTheme === 'dark' ? 'hsl(222 40% 12%)' : 'hsl(0 0% 100%)',
          color: resolvedTheme === 'dark' ? 'hsl(210 30% 96%)' : 'hsl(222 47% 11%)',
          border: `1px solid ${resolvedTheme === 'dark' ? 'hsl(217 28% 20%)' : 'hsl(214 25% 89%)'}`,
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
          borderRadius: '0.75rem',
          fontSize: '0.875rem',
        },
        success: { iconTheme: { primary: '#16a34a', secondary: 'white' } },
        error: { iconTheme: { primary: '#dc2626', secondary: 'white' } },
      }}
    />
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeProvider defaultTheme="system" storageKey="ui-theme">
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <AuthProvider>
            <Routes>
              <Route path="/share/*" element={<PublicRoutes />} />
              <Route path="/*" element={<AppRoutes />} />
            </Routes>
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

export default App;
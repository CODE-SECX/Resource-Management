import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import { Resources } from './pages/Resources';
import { Learning } from './pages/Learning';
import { Index } from './pages/Index';
import { ResourceIndex } from './pages/ResourceIndex';
import { ResourceDetail } from './pages/ResourceDetail';
import { LearningDetail } from './pages/LearningDetail';
import PublicLearning from './pages/PublicLearning';
import PublicResource from './pages/PublicResource';
import { Payloads } from './pages/Payloads';
import { PayloadDetail } from './pages/PayloadDetail';
import { PayloadForm } from './pages/PayloadForm';
import StickyNotes from './pages/StickyNotes';
import Taxonomy from './pages/Taxonomy';
import { LearningForm } from './pages/LearningForm';
import { ResourceForm } from './pages/ResourceForm';
import { Toaster } from 'react-hot-toast';


function AppRoutes() {
  const { user, loading } = useAuth();

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
        <Route path="/payloads" element={<Payloads />} />
        <Route path="/payloads/:id" element={<PayloadDetail />} />
        <Route path="/payloads/create" element={<PayloadForm />} />
        <Route path="/payloads/:id/edit" element={<PayloadForm />} />
        <Route path="/sticky-notes" element={<StickyNotes />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

// Public routes for shared content (no authentication required)
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/learning/:token" element={<PublicLearning />} />
      <Route path="/resource/:token" element={<PublicResource />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
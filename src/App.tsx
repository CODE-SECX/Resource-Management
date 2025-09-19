import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import { Resources } from './pages/Resources';
import { Learning } from './pages/Learning';
import { Categories } from './pages/Categories';
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
import { Toaster } from 'react-hot-toast';


function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
        <Route path="/resources/:id" element={<ResourceDetail />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/learning/index" element={<Index />} />
        <Route path="/learning/:id" element={<LearningDetail />} />
        <Route path="/categories" element={<Categories />} />
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

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
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
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
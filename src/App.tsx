import React from 'react';
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
import { Toaster } from 'react-hot-toast';

// ProtectedRoute component is assumed to be defined elsewhere and handles authentication logic
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to AuthForm if not authenticated
    // You might want to adjust this logic based on your specific needs, e.g., redirect to a login page
    return <AuthForm />;
  }

  return children;
}


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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
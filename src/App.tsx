import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { Resources } from './pages/Resources';
import { Learning } from './pages/Learning';
import { Categories } from './pages/Categories';
import { AuthCallback } from './pages/AuthCallback';
import { Toaster } from 'react-hot-toast';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/learning" element={<Learning />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="dark">
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#25262b',
                color: '#c1c2c5',
                borderColor: '#2c2d32',
              },
            }}
          />
        </AuthProvider>
      </div>
    </BrowserRouter>
  );
}

export default App;
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LoginPage } from './pages/LoginPage.js';

const BoardEditorPage = lazy(() => import('./pages/BoardEditorPage.js'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage.js'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage.js'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: 40 }}>Carregando…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/board/:boardId"
          element={
            <ProtectedRoute>
              <BoardEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <TemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <MarketplacePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

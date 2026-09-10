import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './components/admin/AdminLayout';
import CitizenLayout from './components/citizen/CitizenLayout';

// Admin pages
import DashboardPage    from './pages/DashboardPage';
import MapPage          from './pages/MapPage';
import FieldReportPage  from './pages/FieldReportPage';
import PublicAlertsPage from './pages/PublicAlertsPage';
import PredictorPage    from './pages/PredictorPage';

// Citizen pages
import CitizenDashboard   from './pages/citizen/CitizenDashboard';
import CitizenMapPage     from './pages/citizen/CitizenMapPage';
import CitizenReportsPage from './pages/citizen/CitizenReportsPage';
import CitizenAlertsPage  from './pages/citizen/CitizenAlertsPage';
import WeatherSensorsPage from './pages/WeatherSensorsPage';

// Auth & Public pages
import LandingPage  from './pages/LandingPage';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

/**
 * AdminRoute — only allows district_admin / field_official / admin roles.
 * Citizens are redirected to the Citizen Portal.
 */
function AdminRoute({ children }) {
  const { isAuthenticated, isOfficial } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isOfficial)      return <Navigate to="/citizen" replace />;
  return children;
}

/**
 * CitizenRoute — only allows authenticated citizen-role users.
 * Officials are redirected to admin dashboard.
 */
function CitizenRoute({ children }) {
  const { isAuthenticated, isOfficial } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isOfficial)       return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/*
          IMPORTANT: AuthProvider must be INSIDE <Router> because
          it uses useNavigate() for redirect-on-logout.
        */}
        <Router>
          <AuthProvider>
            <Routes>
              {/* ── Public routes ─────────────────────────────────────── */}
              <Route path="/"         element={<LandingPage />} />
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* ── Citizen Portal — sidebar layout with nested pages ─── */}
              <Route
                element={
                  <CitizenRoute>
                    <CitizenLayout />
                  </CitizenRoute>
                }
              >
                <Route path="/citizen"         element={<CitizenDashboard />} />
                <Route path="/citizen/map"     element={<CitizenMapPage />} />
                <Route path="/citizen/weather" element={<WeatherSensorsPage />} />
                <Route path="/citizen/reports" element={<CitizenReportsPage />} />
                <Route path="/citizen/alerts"  element={<CitizenAlertsPage />} />
              </Route>

              {/* ── Protected Admin Portal routes (wrapped in AdminLayout) ── */}
              <Route
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/map"       element={<MapPage />} />
                <Route path="/report"    element={<FieldReportPage />} />
                <Route path="/alerts"    element={<PublicAlertsPage />} />
                <Route path="/predict"   element={<PredictorPage />} />
              </Route>

              {/* ── Catch-all: redirect unknown URLs to landing page ─── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

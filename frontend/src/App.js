import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Inventory    from './pages/Inventory';
import Orders       from './pages/Orders';
import Production   from './pages/Production';
import Employees    from './pages/Employees';
import Attendance   from './pages/Attendance';
import Payments     from './pages/Payments';
import Reports      from './pages/Reports';
import Notifications from './pages/Notifications';
import TrackOrder   from './pages/TrackOrder';
import WhatsApp     from './pages/WhatsApp';

// Smart home redirect: sends each role to their appropriate landing page
const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-navy-800 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-navy-600 font-medium text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Employee') return <Navigate to="/production" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          success: { iconTheme: { primary: '#1B2A4A', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* Public — no auth required */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/track"    element={<TrackOrder />} />
        <Route path="/"         element={<HomeRedirect />} />

        {/* Protected (all roles) */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['Admin','Manager']}><Layout><Dashboard /></Layout></ProtectedRoute>
        }/>
        <Route path="/inventory" element={
          <ProtectedRoute allowedRoles={['Admin','Manager','Employee']}><Layout><Inventory /></Layout></ProtectedRoute>
        }/>
        <Route path="/orders" element={
          <ProtectedRoute allowedRoles={['Admin','Manager','Employee']}><Layout><Orders /></Layout></ProtectedRoute>
        }/>
        <Route path="/production" element={
          <ProtectedRoute allowedRoles={['Admin','Manager','Employee']}><Layout><Production /></Layout></ProtectedRoute>
        }/>

        <Route path="/employees" element={
          <ProtectedRoute allowedRoles={['Admin']}><Layout><Employees /></Layout></ProtectedRoute>
        }/>
        <Route path="/attendance" element={
          <ProtectedRoute allowedRoles={['Admin','Manager','Employee']}><Layout><Attendance /></Layout></ProtectedRoute>
        }/>
        <Route path="/payments" element={
          <ProtectedRoute allowedRoles={['Admin','Manager']}><Layout><Payments /></Layout></ProtectedRoute>
        }/>
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['Admin','Manager']}><Layout><Reports /></Layout></ProtectedRoute>
        }/>
        <Route path="/notifications" element={
          <ProtectedRoute allowedRoles={['Admin','Manager','Employee']}><Layout><Notifications /></Layout></ProtectedRoute>
        }/>
        <Route path="/whatsapp" element={
          <ProtectedRoute allowedRoles={['Admin']}><Layout><WhatsApp /></Layout></ProtectedRoute>
        }/>

        {/* Catch-all — use HomeRedirect so each role lands on their correct page */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;

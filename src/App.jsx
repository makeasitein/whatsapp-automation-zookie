import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Payment from './pages/Payment';
import Contacts from './pages/Contacts';
import Broadcast from './pages/Broadcast';
import Freeform from './pages/Freeform';
import History from './pages/History';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Refund from './pages/Refund';
import { setupDatabase } from './lib/supabase';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    setupDatabase();
  }, []);

  return (
    <div className="min-h-screen bg-background-dark text-text-main font-outfit selection:bg-primary/30 selection:text-white">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund" element={<Refund />} />

          {/* Protected Routes - Needs Login */}
          <Route element={<ProtectedRoute requirePayment={false} />}>
            <Route path="/payment" element={<Payment />} />
          </Route>

          {/* Protected Routes - Needs Login & Payment */}
          <Route element={<ProtectedRoute requirePayment={true} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/broadcast" element={<Broadcast />} />
            <Route path="/freeform" element={<Freeform />} />
            <Route path="/history" element={<History />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;

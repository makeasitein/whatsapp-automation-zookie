import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ requirePayment = false }) => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requirePayment && profile && !profile.payment_status) {
        return <Navigate to="/payment" replace />;
    }

    return <Outlet />;
};

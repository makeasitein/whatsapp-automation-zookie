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

    // Security Fix: If payment is required, we MUST have a profile to verify eligibility.
    // If profile failed to load but user exists, we cannot grant access.
    if (requirePayment) {
        // If profile is still null here, it means backend fetch failed or user has no profile row.
        // We can't let them in, but we should probably redirect to payment with a warning.
        if (!profile) {
            // Force redirect to payment, assuming new user without profile needs payment anyway.
             return <Navigate to="/payment" replace />;
        }

        // Prepaid Model Check: 'valid_until' must be in the future
        let hasAccess = false;
        const now = new Date();

        // 1. Check validity date (Primary Source of Truth)
        if (profile.valid_until) {
            const validUntilDate = new Date(profile.valid_until);
            if (validUntilDate > now) {
                hasAccess = true;
            }
        }
        
        // 2. Fallback: If no date set, check manual override status, but default to FALSE for new users
        // New users likely have valid_until = null and payment_status = false
        // Legacy or manual admin grants might have payment_status = true without date
        else if (profile.payment_status === true) {
             hasAccess = true;
        }

        if (!hasAccess) {
            return <Navigate to="/payment" replace />;
        }
    }

    // Default: Return outlet for non-payment protected routes OR if payment check passed
    return <Outlet />;
};

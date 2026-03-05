import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionGuardProps = {
    children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { hasActiveSubscription, expirationDate, isLoading } = useSubscription();
    const { user } = useAuth();
    const location = useLocation();

    // CRITICAL: Only block on the very first load (when we have no subscription
    // data at all). Background re-checks (e.g. after onboarding or token refresh)
    // must run silently — otherwise the dashboard freezes on every Google OAuth return.
    // `hasActiveSubscription` starts as `false` and `expirationDate` as null,
    // so we use isLoading + no expirationDate as the "truly first load" signal.
    if (isLoading && expirationDate === null && user?.role !== 'superadmin' && user?.role !== 'staff') {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Superadmin y staff tienen suscripción perpetua — AuthGuard ya los redirige,
    // pero como capa de seguridad adicional los dejamos pasar.
    if (user?.role === 'superadmin' || user?.role === 'staff') {
        return <>{children}</>;
    }

    // Siempre permitir /subscription para que el usuario pueda pagar o activar trial
    if (location.pathname === '/subscription') {
        return <>{children}</>;
    }

    if (!hasActiveSubscription) {
        return <Navigate to="/subscription" replace />;
    }

    return <>{children}</>;
};

export default SubscriptionGuard;

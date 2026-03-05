import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionGuardProps = {
    children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { hasActiveSubscription, isLoading, isInitialized } = useSubscription();
    const { user } = useAuth();
    const location = useLocation();

    // RULE 9.2 (.cursorrules): Use isInitialized to detect first load, NOT expirationDate === null.
    // Using expirationDate === null creates a cycle: expirationDate=null → isLoading=true →
    // SubscriptionGuard shows black screen → checkSubscription resets expirationDate=null → ...
    // Only show the blocking spinner before the very first subscription check completes.
    if (isLoading && !isInitialized) {
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

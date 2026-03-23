import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionGuardProps = {
    children: React.ReactNode;
}

/**
 * Guard que bloquea el acceso a rutas protegidas cuando el tenant no tiene
 * suscripción activa.
 *
 * Lógica:
 * - Spinner solo antes de que se complete el PRIMER chequeo de suscripción
 *   (`isLoading && !isInitialized`). Chequeos posteriores son silenciosos.
 *   Usar `expirationDate === null` como condición de carga crea un ciclo
 *   infinito porque checkSubscription resetea expirationDate a null en cada llamada.
 * - Superadmin y staff tienen suscripción perpetua (ya configurada en checkSubscription).
 * - La ruta /subscription siempre pasa — el usuario debe poder acceder para pagar o activar trial.
 * - Sin suscripción activa → redirige a /subscription.
 */
const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { hasActiveSubscription, isLoading, isInitialized } = useSubscription();
    const { user } = useAuth();
    const location = useLocation();

    if (isLoading && !isInitialized) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (user?.role === 'superadmin' || user?.role === 'staff') {
        return <>{children}</>;
    }

    if (location.pathname === '/subscription') {
        return <>{children}</>;
    }

    if (!hasActiveSubscription) {
        return <Navigate to="/subscription" replace />;
    }

    return <>{children}</>;
};

export default SubscriptionGuard;

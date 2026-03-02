import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

type AuthGuardProps = {
    children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const { user, isAuthenticated, hasTenant, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated && location.pathname !== "/login") {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Redirigir staff SIEMPRE a /recepcion — sin importar hasTenant
    if (isAuthenticated && user?.role === 'staff') {
        if (!location.pathname.startsWith('/recepcion')) {
            return <Navigate to="/recepcion" replace />;
        }
        // Staff ya está en /recepcion → mostrar contenido directamente
        return <>{children}</>;
    }

    // Forzar a los superadmins a mantenerse en su ámbito
    if (isAuthenticated && user?.role === 'superadmin' && !location.pathname.startsWith('/admin')) {
        return <Navigate to="/admin" replace />;
    }

    // Si está autenticado pero no tiene empresa configurada, forzar Onboarding (solo para admin)
    if (isAuthenticated && !hasTenant && location.pathname !== "/onboarding" && user?.role !== 'superadmin') {
        return <Navigate to="/onboarding" replace />;
    }

    // Si ya tiene empresa e intenta entrar a Onboarding, redirigir al dashboard
    if (isAuthenticated && hasTenant && location.pathname === "/onboarding") {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};


export default AuthGuard;

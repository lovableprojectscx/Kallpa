import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

type AuthGuardProps = {
    children: React.ReactNode;
}

/**
 * Guard de autenticación para rutas del panel principal (admin/staff).
 *
 * Orden de evaluación:
 * 1. Si todavía no hay datos de usuario (primera carga), muestra spinner.
 *    Una vez que `user` es conocido, los re-checks de token en background
 *    NO muestran spinner para evitar que Framer Motion re-ejecute animaciones.
 * 2. Sin sesión → redirige a /login guardando la ruta original en `state.from`.
 * 3. Staff → siempre a /recepcion, sin importar hasTenant.
 * 4. Superadmin → siempre dentro de /admin.
 * 5. Admin sin tenant → /onboarding (solo cuando isLoading=false para evitar
 *    falsos positivos durante refreshes de token donde tenantId es momentáneamente null).
 * 6. Admin con tenant intentando entrar a /onboarding → /dashboard.
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const { user, isAuthenticated, hasTenant, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading && !user) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated && location.pathname !== "/login") {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (isAuthenticated && user?.role === 'staff') {
        if (!location.pathname.startsWith('/recepcion')) {
            return <Navigate to="/recepcion" replace />;
        }
        return <>{children}</>;
    }

    if (isAuthenticated && user?.role === 'superadmin' && !location.pathname.startsWith('/admin')) {
        return <Navigate to="/admin" replace />;
    }

    if (!isLoading && isAuthenticated && !hasTenant && location.pathname !== "/onboarding" && user?.role !== 'superadmin') {
        return <Navigate to="/onboarding" replace />;
    }

    if (isAuthenticated && hasTenant && location.pathname === "/onboarding") {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default AuthGuard;

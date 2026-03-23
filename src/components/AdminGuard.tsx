import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

type AdminGuardProps = {
    children: React.ReactNode;
}

/**
 * Guard exclusivo para las rutas del panel de superadmin (/admin/*).
 *
 * - Spinner solo en la primera carga sin usuario conocido (mismo patrón que AuthGuard).
 * - Cualquier usuario que no sea superadmin es redirigido a /dashboard.
 *   (AuthGuard ya impide que lleguen aquí, pero esta capa es la defensa final.)
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading && !user) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (user?.role !== 'superadmin') {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default AdminGuard;

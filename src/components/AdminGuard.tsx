import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

type AdminGuardProps = {
    children: React.ReactNode;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    // Same pattern as AuthGuard: only block on first load, not on background re-checks.
    // If user is already known, skip the spinner to avoid freezing the admin panel.
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

import React from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SubscriptionGuardProps {
    children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { hasActiveSubscription } = useSubscription();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();



    return <>{children}</>;
};

export default SubscriptionGuard;

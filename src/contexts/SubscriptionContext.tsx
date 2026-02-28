import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface SubscriptionContextType {
    hasActiveSubscription: boolean;
    expirationDate: Date | null;
    checkSubscription: () => void;
    redeemMembershipCode: (code: string) => Promise<boolean>;
    requireSubscription: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, hasTenant } = useAuth();
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
    const [expirationDate, setExpirationDate] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSubscription = async () => {
        if (!user || user.role === 'superadmin') {
            setHasActiveSubscription(true);
            setExpirationDate(new Date(2099, 11, 31));
            setIsLoading(false);
            return;
        }

        // Staff hereda la suscripción del gym — no necesita verificar por separado
        if (user.role === 'staff') {
            setHasActiveSubscription(true);
            setExpirationDate(new Date(2099, 11, 31));
            setIsLoading(false);
            return;
        }

        if (!hasTenant) {
            setHasActiveSubscription(false);
            setExpirationDate(null);
            setIsLoading(false);
            return;
        }

        try {
            // Buscar si el tenant tiene una licencia activa
            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('redeemed_by', user.tenantId)
                .eq('status', 'redeemed')
                .order('redeemed_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // Ignorar error de no filas
                console.error("Error al verificar suscripción:", error);
            }

            if (data && data.redeemed_at) {
                const redeemedDate = new Date(data.redeemed_at);
                const expiry = new Date(redeemedDate.setMonth(redeemedDate.getMonth() + data.duration_months));

                setExpirationDate(expiry);
                setHasActiveSubscription(expiry > new Date());
            } else {
                setHasActiveSubscription(false);
                setExpirationDate(null);
            }
        } catch (error) {
            console.error("Unexpected error checking subscription", error);
            setHasActiveSubscription(false);
            setExpirationDate(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        checkSubscription();
    }, [user, hasTenant]);

    const redeemMembershipCode = async (code: string): Promise<boolean> => {
        if (!user || !user.tenantId) {
            toast.error("Debes tener un gimnasio configurado para canjear un código.");
            return false;
        }

        try {
            // 1. Verificar si el código existe y está disponible
            const { data: license, error: fetchError } = await supabase
                .from('licenses')
                .select('*')
                .eq('code', code)
                .eq('status', 'available')
                .single();

            if (fetchError || !license) {
                return false;
            }

            // 2. Marcar como canjeado
            const { error: updateError } = await supabase
                .from('licenses')
                .update({
                    status: 'redeemed',
                    redeemed_by: user.tenantId,
                    redeemed_at: new Date().toISOString()
                })
                .eq('id', license.id)
                .eq('status', 'available'); // Doble check de seguridad

            if (updateError) throw updateError;

            // 3. Award 1 credit to the affiliate who referred this tenant (if any)
            try {
                // Get the owner profile of this tenant (the current user)
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', user.id)
                    .single();

                if (ownerProfile?.referred_by) {
                    // Find the affiliate record for the referrer
                    const { data: affiliateRecord } = await supabase
                        .from('affiliates')
                        .select('id, profile_id, credits_balance')
                        .eq('id', ownerProfile.referred_by)
                        .eq('status', 'active')
                        .single();

                    if (affiliateRecord) {
                        // 100 créditos = 1 mes extra de suscripción
                        const dur = license.duration_months || 1;
                        const creditsToAdd = dur * 100;

                        const reasonText = `Referido activó ${dur} mes${dur > 1 ? 'es' : ''} → +${creditsToAdd} créditos (Tenant: ${user.tenantId})`;

                        const { error: rpcError } = await supabase.rpc('award_affiliate_credit_v2', {
                            p_affiliate_id: affiliateRecord.id,
                            p_credits: creditsToAdd,
                            p_tenant_id: user.tenantId,
                            p_reason: reasonText
                        });

                        if (rpcError) throw rpcError;
                    }
                }
            } catch (creditError) {
                // Non-critical: don't fail the whole redemption if credit awarding fails
                console.warn("Could not award affiliate credit:", creditError);
            }

            // 4. Update local state correctly
            const expiry = new Date();
            if (license.duration_months) {
                expiry.setMonth(expiry.getMonth() + license.duration_months);
            } else {
                expiry.setMonth(expiry.getMonth() + 1);
            }

            setExpirationDate(expiry);
            setHasActiveSubscription(true);
            return true;
        } catch (error) {
            console.error("Error redeeming code:", error);
            return false;
        }
    };

    const requireSubscription = (): boolean => {
        if (hasActiveSubscription || user?.role === 'superadmin') return true;
        toast.error(
            'Suscripción requerida — Adquiere un Plan PRO para tu gimnasio.',
            {
                action: {
                    label: 'Ver Planes PRO',
                    onClick: () => { window.location.href = '/subscription'; },
                },
                duration: 6000,
            }
        );
        return false;
    };

    return (
        <SubscriptionContext.Provider value={{ hasActiveSubscription, expirationDate, checkSubscription, redeemMembershipCode, requireSubscription }}>
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error("useSubscription must be used within a SubscriptionProvider");
    }
    return context;
};

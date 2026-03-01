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
    hasUsedTrial: boolean;
    activateTrial: () => Promise<boolean>;
    isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, hasTenant } = useAuth();
    const navigate = useNavigate();
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
    const [expirationDate, setExpirationDate] = useState<Date | null>(null);
    const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkSubscription = async () => {
        try {
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
                setHasUsedTrial(false);
                setIsLoading(false);
                return;
            }

            // Check for trial usage specifically
            const { data: trialData } = await supabase
                .from('licenses')
                .select('id')
                .eq('redeemed_by', user.tenantId)
                .like('code', 'TRIAL-%')
                .limit(1)
                .maybeSingle();

            setHasUsedTrial(!!trialData);

            // Buscar si el tenant tiene una licencia activa
            const { data, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('redeemed_by', user.tenantId)
                .eq('status', 'redeemed')
                .order('redeemed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("Error al verificar suscripción:", error);
            }

            if (data && data.redeemed_at) {
                const redeemedDate = new Date(data.redeemed_at);
                let expiry: Date;

                if (data.duration_months === 0 || data.code?.startsWith('TRIAL-')) {
                    // Trial mode: 3 days
                    expiry = new Date(redeemedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                } else {
                    // Standard subscription — clonar la fecha antes de mutar para evitar side effects
                    const expiryDate = new Date(redeemedDate);
                    expiryDate.setMonth(expiryDate.getMonth() + data.duration_months);
                    expiry = expiryDate;
                }

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
        // Solo marcar cargando si es la primera vez o si el usuario cambió realmente
        if (!expirationDate) {
            setIsLoading(true);
        }
        checkSubscription();
    }, [user, hasTenant]);

    const activateTrial = async (): Promise<boolean> => {
        if (!user || !user.tenantId) {
            toast.error("Debes tener un gimnasio configurado.");
            return false;
        }

        if (hasUsedTrial) {
            toast.error("Ya has utilizado la prueba gratuita anteriormente.");
            return false;
        }

        try {
            const { data, error: rpcError } = await supabase.rpc('activate_gym_trial');

            if (rpcError) throw rpcError;

            if (data && !data.success) {
                toast.error(data.message || "No se pudo activar la prueba.");
                return false;
            }

            toast.success("¡Prueba de 3 días activada con éxito!");
            await checkSubscription();
            return true;
        } catch (error) {
            console.error("Error activating trial:", error);
            toast.error("No se pudo activar la prueba.");
            return false;
        }
    };

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

        if (!hasUsedTrial && user?.role !== 'superadmin') {
            toast.error(
                'Suscripción requerida — Tienes una prueba gratis disponible.',
                {
                    description: "Activa tu prueba de 3 días para continuar, o elige un plan PRO.",
                    action: {
                        label: 'Activar Prueba',
                        onClick: async () => {
                            const success = await activateTrial();
                            if (success) {
                                toast.success("¡Tu prueba gratuita ha comenzado!");
                            }
                        },
                    },
                    cancel: {
                        label: 'Ver Planes',
                        onClick: () => { navigate('/subscription'); }
                    },
                    duration: 8000,
                }
            );
        } else {
            toast.error(
                'Suscripción requerida — Adquiere un Plan PRO para tu gimnasio.',
                {
                    action: {
                        label: 'Ver Planes PRO',
                        onClick: () => { navigate('/subscription'); },
                    },
                    duration: 6000,
                }
            );
        }
        return false;
    };

    return (
        <SubscriptionContext.Provider value={{
            hasActiveSubscription,
            expirationDate,
            checkSubscription,
            redeemMembershipCode,
            requireSubscription,
            hasUsedTrial,
            activateTrial,
            isLoading
        }}>
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

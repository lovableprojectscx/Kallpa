import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface SubscriptionContextType {
    hasActiveSubscription: boolean;
    expirationDate: Date | null;
    checkSubscription: () => Promise<void>;
    redeemMembershipCode: (code: string) => Promise<boolean>;
    requireSubscription: () => boolean;
    hasUsedTrial: boolean;
    activateTrial: () => Promise<boolean>;
    isLoading: boolean;
    isInitialized: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, hasTenant } = useAuth();
    const navigate = useNavigate();
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
    const [expirationDate, setExpirationDate] = useState<Date | null>(null);
    const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false);
    // isLoading=true solo en el primer chequeo (antes de conocer el estado de suscripción).
    // Los re-chequeos posteriores son silenciosos para no mostrar un flash de pantalla negra.
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    /**
     * Consulta todas las licencias del tenant y recalcula la fecha de expiración
     * usando algoritmo de stacking (apilamiento):
     * - Si la licencia se canjeó DESPUÉS de que expiró la anterior → nueva línea de tiempo.
     * - Si se canjeó ANTES de que expire la anterior → se apila desde la fecha de expiración actual.
     * Roles especiales (superadmin, staff) reciben suscripción perpetua al año 2099.
     */
    const checkSubscription = async () => {
        try {
            if (!user || user.role === 'superadmin') {
                setHasActiveSubscription(true);
                setExpirationDate(new Date(2099, 11, 31));
                setIsLoading(false);
                setIsInitialized(true);
                return;
            }

            // Staff hereda la suscripción del gym — no necesita verificar por separado
            if (user.role === 'staff') {
                setHasActiveSubscription(true);
                setExpirationDate(new Date(2099, 11, 31));
                setIsLoading(false);
                setIsInitialized(true);
                return;
            }

            if (!hasTenant) {
                setHasActiveSubscription(false);
                setExpirationDate(null);
                setHasUsedTrial(false);
                setIsLoading(false);
                setIsInitialized(true);
                return;
            }

            // Verificar si el tenant ya usó su trial
            const { data: trialData } = await supabase
                .from('licenses')
                .select('id')
                .eq('redeemed_by', user.tenantId)
                .like('code', 'TRIAL-%')
                .limit(1)
                .maybeSingle();

            setHasUsedTrial(!!trialData);

            // Cargar todas las licencias canjeadas en orden ASCENDENTE para el stacking
            const { data: licenses, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('redeemed_by', user.tenantId)
                .eq('status', 'redeemed')
                .order('redeemed_at', { ascending: true });

            if (error) {
                console.error("Error al verificar suscripción:", error);
            }

            if (licenses && licenses.length > 0) {
                let currentExpiry: Date | null = null;

                for (const license of licenses) {
                    if (!license.redeemed_at) continue;

                    const redeemedDate = new Date(license.redeemed_at);
                    const isTrial = license.duration_months === 0 || license.code?.startsWith('TRIAL-');

                    // Determinar desde dónde apilar esta licencia
                    let startDate: Date;
                    if (!currentExpiry || currentExpiry < redeemedDate) {
                        // Sin suscripción previa o hueco entre licencias: empieza desde el canje
                        startDate = new Date(redeemedDate);
                    } else {
                        // Renovación temprana: apilamos desde la expiración actual
                        startDate = new Date(currentExpiry);
                    }

                    if (isTrial) {
                        startDate.setDate(startDate.getDate() + 3);
                    } else {
                        startDate.setMonth(startDate.getMonth() + (license.duration_months || 0));
                    }

                    currentExpiry = startDate;
                }

                if (currentExpiry) {
                    setExpirationDate(currentExpiry);
                    setHasActiveSubscription(currentExpiry > new Date());
                } else {
                    setHasActiveSubscription(false);
                    setExpirationDate(null);
                }
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
            setIsInitialized(true);
        }
    };

    useEffect(() => {
        // Solo mostrar el spinner bloqueante en el primer chequeo.
        // Los re-chequeos (ej. después de onboarding cuando cambia tenantId)
        // se ejecutan en silencio sin flashear pantalla negra.
        if (!isInitialized) {
            setIsLoading(true);
        }
        void checkSubscription();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, user?.tenantId, user?.role, hasTenant]);

    /**
     * Activa la prueba gratuita de 3 días llamando a la función RPC `activate_gym_trial`.
     * Guards:
     * - Requiere usuario con tenant configurado.
     * - Verifica que el trial no haya sido usado previamente (hasUsedTrial).
     * Después de activar, recalcula la suscripción para reflejar el trial inmediatamente.
     */
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

    /**
     * Canjea un código de licencia para el tenant del usuario autenticado.
     * Flujo:
     * 1. Verifica que el código exista y esté disponible (status='available').
     * 2. Actualiza el estado a 'redeemed' con doble check `.eq('status','available')`
     *    para protección contra race conditions entre peticiones concurrentes.
     * 3. Intenta otorgar créditos al afiliado que refirió al tenant (no crítico —
     *    si falla, el canje sigue siendo válido).
     * 4. Recalcula la suscripción desde la BD para reflejar el stacking real.
     * Retorna true si el canje fue exitoso, false si falló.
     */
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
                toast.error("Código inválido o ya fue canjeado.");
                return false;
            }

            // 2. Marcar como canjeado (doble check de status para evitar race condition)
            const { error: updateError } = await supabase
                .from('licenses')
                .update({
                    status: 'redeemed',
                    redeemed_by: user.tenantId,
                    redeemed_at: new Date().toISOString()
                })
                .eq('id', license.id)
                .eq('status', 'available');

            if (updateError) throw updateError;

            // 3. Otorgar créditos al afiliado referidor (operación no crítica)
            try {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', user.id)
                    .single();

                if (ownerProfile?.referred_by) {
                    const { data: affiliateRecord } = await supabase
                        .from('affiliates')
                        .select('id, profile_id, credits_balance')
                        .eq('id', ownerProfile.referred_by)
                        .eq('status', 'active')
                        .single();

                    if (affiliateRecord) {
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
                // No crítico: no fallamos el canje si el crédito al afiliado falla
                console.warn("Could not award affiliate credit:", creditError);
            }

            // 4. Recalcular la suscripción desde la BD para reflejar el stacking real
            await checkSubscription();
            return true;
        } catch (error) {
            console.error("Error redeeming code:", error);
            return false;
        }
    };

    /**
     * Verifica si el usuario tiene suscripción activa.
     * Si no la tiene, muestra un toast con acciones contextuales:
     * - Si aún no usó el trial: ofrece activarlo directamente desde el toast.
     * - Si ya lo usó: redirige a /subscription para comprar un plan PRO.
     * Retorna true si tiene suscripción activa, false si no.
     */
    const requireSubscription = (): boolean => {
        if (hasActiveSubscription || user?.role === 'superadmin') return true;

        if (!hasUsedTrial) {
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
            isLoading,
            isInitialized
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
};

/** Hook para acceder al contexto de suscripción. Lanza si se usa fuera de SubscriptionProvider. */
export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error("useSubscription must be used within a SubscriptionProvider");
    }
    return context;
};

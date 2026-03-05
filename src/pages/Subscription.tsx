import { useState, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Crown, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Subscription() {
    const { user } = useAuth();
    const { hasActiveSubscription, expirationDate, checkSubscription, hasUsedTrial, activateTrial, redeemMembershipCode } = useSubscription();
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [activationCode, setActivationCode] = useState("");
    const [isRedeeming, setIsRedeeming] = useState(false);

    useEffect(() => {
        // Check URL parameters for Mercado Pago redirect status
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        if (paymentStatus === 'success') {
            toast.success("¡Pago exitoso! Tu suscripción ha sido actualizada (puede tardar unos segundos en reflejarse)", { duration: 8000 });
            window.history.replaceState({}, document.title, window.location.pathname);
            void checkSubscription();
        } else if (paymentStatus === 'failure') {
            toast.error("El pago no pudo ser procesado o fue cancelado.");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentStatus === 'pending') {
            toast.warning("El pago está pendiente de acreditación. Te avisaremos cuando se confirme.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBuySubscription = async (months: number, pricePen: number) => {
        if (!user?.tenantId) return;
        setIsProcessingPayment(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                throw new Error("Sesión expirada o inválida. Por favor inicia sesión nuevamente.");
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
            const response = await fetch(`${supabaseUrl}/functions/v1/create-mp-preference-v3`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    planDuration: months,
                    pricePen: pricePen,
                    tenantId: user.tenantId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                let detail = data?.detail || data?.error || "";
                throw new Error(detail || "Error desconocido al procesar pago");
            }

            if (!data || !data.init_point) throw new Error("No se recibió link de pago");

            window.location.href = data.init_point;

        } catch (err: any) {
            console.error("Error creating MP preference:", err);
            toast.error("Error de conexión: " + err.message, { duration: 6000 });
            setIsProcessingPayment(false);
        }
    };

    const handleActivateTrial = async () => {
        setIsProcessingPayment(true);
        const success = await activateTrial();
        setIsProcessingPayment(false);
        if (success) {
            toast.success("¡Tu prueba gratuita de 3 días ha comenzado!");
        }
    };

    const handleRedeemCode = async () => {
        if (!activationCode.trim()) {
            toast.error("Ingresa un código válido");
            return;
        }

        setIsRedeeming(true);
        const success = await redeemMembershipCode(activationCode.trim());
        setIsRedeeming(false);

        if (success) {
            toast.success("¡Código canjeado con éxito! Tu gimnasio ha sido activado.");
            setActivationCode("");
            // redeemMembershipCode ya llama checkSubscription() internamente — no duplicar aquí
        } else {
            toast.error("Código inválido, expirado o ya utilizado.");
        }
    };

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-center sm:text-left"
                >
                    <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 sm:hidden">
                        <Crown className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-4xl font-bold text-foreground flex items-center justify-center sm:justify-start gap-3">
                        <Crown className="h-8 w-8 text-primary hidden sm:block" />
                        Planes KALLPA PRO
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-2xl mx-auto sm:mx-0">
                        Mantén tu gimnasio funcionando sin interrupciones. Elige el plan que mejor se adapte a ti y disfruta de todas las herramientas de KALLPA.
                    </p>
                </motion.div>

                {/* Estado Actual */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 border shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] mt-6 sm:mt-8 ${hasActiveSubscription ? 'bg-gradient-to-br from-success/20 to-success/5 border-success/30' : 'bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/30'}`}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className={`text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold mb-1 ${hasActiveSubscription ? 'text-success' : 'text-destructive'}`}>Estado de tu Sistema</p>
                            <h3 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                                {hasActiveSubscription ? 'Operativo' : (user?.role === 'superadmin' ? 'Vitalicio (Master)' : 'Vencido / Inactivo')}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                                {user?.role === 'superadmin'
                                    ? 'Licencia de propietario global. Sin expiración.'
                                    : hasActiveSubscription && expirationDate
                                        ? <>Válida hasta el <span className="text-foreground font-bold font-mono text-xs sm:text-sm">{expirationDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span></>
                                        : 'Debes adquirir un plan para operar de forma ilimitada.'
                                }
                            </p>
                        </div>
                        <ShieldCheck className={`h-10 w-10 sm:h-16 sm:w-16 drop-shadow-md shrink-0 ml-4 ${hasActiveSubscription ? 'text-success/60' : 'text-destructive/60'}`} />
                    </div>
                    <div className={`absolute top-0 right-0 w-32 h-32 blur-[50px] -mr-10 -mt-10 ${hasActiveSubscription ? 'bg-success/20' : 'bg-destructive/20'}`} />
                </motion.div>

                {/* Trial Activation Banner */}
                {!hasActiveSubscription && user?.role !== 'superadmin' && !hasUsedTrial && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-[#D3FF24]/30 bg-gradient-to-br from-[#D3FF24]/10 to-transparent shadow-[0_0_30px_rgba(211,255,36,0.1)] mt-6"
                    >
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                            <div className="text-center sm:text-left">
                                <h3 className="text-xl sm:text-2xl font-black text-[#D3FF24] mb-2 flex items-center justify-center sm:justify-start gap-2">
                                    <Sparkles className="h-5 w-5" />
                                    Prueba Gratuita de 3 Días
                                </h3>
                                <p className="text-sm sm:text-base text-gray-300">
                                    Desbloquea todas las funciones PRO sin compromiso. Ideal para probar todo el potencial de Kallpa.
                                </p>
                            </div>
                            <Button
                                onClick={handleActivateTrial}
                                disabled={isProcessingPayment}
                                className="w-full sm:w-auto h-12 px-8 bg-[#D3FF24] hover:bg-[#b8e61b] text-black font-bold whitespace-nowrap glow-volt shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                            >
                                {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Activar Prueba VIP"}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Redeem Code Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.18 }}
                    className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-card border shadow-sm mt-6"
                >
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="text-center sm:text-left flex-1 w-full">
                            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 flex items-center justify-center sm:justify-start gap-2">
                                ¿Tienes un código de activación?
                            </h3>
                            <p className="text-sm sm:text-base text-muted-foreground mb-4">
                                Ingresa tu código de licencia para activar tu sistema de inmediato.
                            </p>
                            <div className="flex gap-2 max-w-md mx-auto sm:mx-0">
                                <input
                                    type="text"
                                    placeholder="Ej: KALLPA-1234-ABCD"
                                    value={activationCode}
                                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                                />
                                <Button
                                    onClick={handleRedeemCode}
                                    disabled={isRedeeming || !activationCode.trim()}
                                    className="whitespace-nowrap"
                                >
                                    {isRedeeming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Activar Código"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Planes de Suscripción Automática */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 mt-12 mb-8"
                >
                    <div className="col-span-full mb-4 text-center">
                        <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-2 flex items-center justify-center gap-3">
                            <CreditCard className="h-6 w-6 text-[#D3FF24]" />
                            Selecciona tu Plan PRO
                        </h3>
                        <p className="text-sm sm:text-base text-gray-400">
                            Pago 100% seguro a través de Mercado Pago. La activación es automática e instantánea.
                        </p>
                    </div>

                    {[
                        {
                            months: 1,
                            name: "Básico",
                            price: 35,
                            popular: false,
                            icon: (
                                <svg className="w-8 h-8 md:w-10 md:h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="url(#bolt-grad)" stroke="url(#bolt-grad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                    <defs>
                                        <linearGradient id="bolt-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#A3E635" />
                                            <stop offset="1" stopColor="#4ADE80" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            ),
                            description: "Ideal para la gestión esencial.",
                            features: ["Acceso completo al sistema", "Soporte estándar", "Actualizaciones incluidas"]
                        },
                        {
                            months: 3,
                            name: "Trimestral",
                            price: 89,
                            oldPrice: 105,
                            popular: false,
                            icon: (
                                <svg className="w-8 h-8 md:w-10 md:h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" fill="url(#target-grad)" />
                                    <defs>
                                        <linearGradient id="target-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#60A5FA" />
                                            <stop offset="1" stopColor="#3B82F6" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            ),
                            description: "Compromiso a corto plazo.",
                            features: ["Acceso completo al sistema", "Soporte estándar", "Ahorra S/ 16"]
                        },
                        {
                            months: 6,
                            name: "Semestral",
                            price: 159,
                            oldPrice: 210,
                            popular: true,
                            icon: (
                                <svg className="w-8 h-8 md:w-10 md:h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2 20H22M4 20L5.5 6.5L10 12L12 4L14 12L18.5 6.5L20 20H4Z" fill="url(#crown-grad)" strokeOpacity="0.2" stroke="white" strokeWidth="1" strokeLinejoin="round" />
                                    <circle cx="12" cy="4" r="1.5" fill="#FFE814" />
                                    <circle cx="5.5" cy="6.5" r="1.5" fill="#FFE814" />
                                    <circle cx="18.5" cy="6.5" r="1.5" fill="#FFE814" />
                                    <defs>
                                        <linearGradient id="crown-grad" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#D3FF24" />
                                            <stop offset="1" stopColor="#84CA16" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            ),
                            description: "La opción inteligente.",
                            features: ["Acceso completo al sistema", "Soporte prioritario", "Ahorra S/ 51"]
                        },
                        {
                            months: 12,
                            name: "Anual",
                            price: 279,
                            oldPrice: 420,
                            popular: false,
                            icon: (
                                <svg className="w-8 h-8 md:w-10 md:h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 3H18L22 9L12 21L2 9L6 3Z" fill="url(#diamond-grad)" strokeOpacity="0.3" stroke="white" strokeWidth="0.5" strokeLinejoin="round" />
                                    <path d="M12 21L6 9H18L12 21ZM6 9L6 3H18L18 9ZM2 9L6 9L6 3Z" fill="none" strokeOpacity="0.3" stroke="white" strokeWidth="1" strokeLinejoin="round" />
                                    <defs>
                                        <linearGradient id="diamond-grad" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#A855F7" />
                                            <stop offset="1" stopColor="#6366F1" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            ),
                            description: "Máximo ahorro asegurado.",
                            features: ["Acceso completo al sistema", "Soporte VIP 24/7", "Ahorra S/ 141"]
                        }
                    ].map((plan, index) => (
                        <motion.div
                            key={plan.months}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 + (index * 0.1) }}
                            className="flex"
                        >
                            <Card className={`relative overflow-hidden w-full flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl rounded-3xl ${plan.popular
                                ? 'bg-gradient-to-br from-[#D3FF24]/[0.05] to-transparent border border-[#D3FF24]/50 shadow-[0_0_30px_rgba(211,255,36,0.15)] glow-volt-card ring-1 ring-[#D3FF24]/20'
                                : 'bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:border-white/20'
                                }`}>
                                {plan.popular && (
                                    <>
                                        <div className="absolute top-0 right-0 bg-[#D3FF24] text-black text-[10px] md:text-xs font-black uppercase tracking-wider py-1.5 px-4 rounded-bl-2xl shadow-lg z-10 origin-top-right">
                                            La más popular
                                        </div>
                                        {/* Subtle animated shine */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#D3FF24]/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                                    </>
                                )}
                                <CardContent className="p-6 sm:p-8 flex flex-col h-full relative z-10">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="mb-4 sm:mb-6">
                                            {plan.icon}
                                        </div>
                                        <h4 className={`text-xl sm:text-2xl font-black font-display tracking-tight ${plan.popular ? 'text-[#D3FF24]' : 'text-white'}`}>{plan.name}</h4>
                                        <p className="text-xs sm:text-sm text-gray-400 mt-1">{plan.description}</p>

                                        <div className="mt-5 sm:mt-6 mb-2 flex items-baseline justify-center gap-1">
                                            <span className="text-sm font-semibold text-gray-400">S/</span>
                                            <span className="text-4xl sm:text-6xl font-black text-white leading-none tracking-tighter">{plan.price}</span>
                                            <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
                                                / {plan.months} {plan.months === 1 ? 'mes' : 'meses'}
                                            </span>
                                        </div>
                                        {plan.oldPrice ? (
                                            <div className="text-xs font-medium text-gray-500 mb-6 bg-white/5 rounded-full px-3 py-1 inline-block">
                                                Normalmente <span className="line-through">S/ {plan.oldPrice}</span>
                                            </div>
                                        ) : (
                                            <div className="mb-6 h-6" />
                                        )}
                                    </div>

                                    <div className="flex-1 mt-2 mb-8 space-y-3">
                                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />
                                        {plan.features.map((feat, i) => (
                                            <div key={i} className="flex items-start gap-3 text-sm text-gray-300">
                                                <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check className={`h-3 w-3 ${plan.popular ? 'text-[#D3FF24]' : 'text-gray-400'}`} />
                                                </div>
                                                <span className="text-left font-medium leading-tight">{feat}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={() => handleBuySubscription(plan.months, plan.price)}
                                        disabled={isProcessingPayment}
                                        className={`w-full mt-auto font-bold text-sm sm:text-base h-12 md:h-14 rounded-xl transition-all shadow-md group ${plan.popular
                                            ? 'bg-[#D3FF24] text-black hover:bg-[#bceb16] shadow-[0_0_20px_rgba(211,255,36,0.2)] hover:shadow-[0_0_30px_rgba(211,255,36,0.4)] hover:scale-105'
                                            : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/5'
                                            }`}
                                    >
                                        {isProcessingPayment ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-current" />
                                        ) : (
                                            <span className="flex items-center justify-center">
                                                {hasActiveSubscription ? 'Renovar Plan' : 'Empezar Ahora'}
                                            </span>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                <div className="text-center text-xs text-muted-foreground mt-12 py-6 border-t border-border/30">
                    <p>Los pagos son procesados de forma segura por Mercado Pago. KALLPA no almacena información de tarjetas de crédito.</p>
                </div>
            </div>
        </>
    );
}

import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Crown, Zap, Rocket, Diamond, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Subscription() {
    const { user } = useAuth();
    const { hasActiveSubscription, expirationDate, checkSubscription } = useSubscription();
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    useEffect(() => {
        // Check URL parameters for Mercado Pago redirect status
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        if (paymentStatus === 'success') {
            toast.success("¡Pago exitoso! Tu suscripción ha sido actualizada (puede tardar unos segundos en reflejarse)", { duration: 8000 });
            // Limpiar la URL para evitar que se repita el toast al recargar
            window.history.replaceState({}, document.title, window.location.pathname);
            // Refrescar el estado global de la suscripción
            checkSubscription && checkSubscription();
        } else if (paymentStatus === 'failure') {
            toast.error("El pago no pudo ser procesado o fue cancelado.");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentStatus === 'pending') {
            toast.warning("El pago está pendiente de acreditación. Te avisaremos cuando se confirme.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [checkSubscription]);

    const handleBuySubscription = async (months: number, pricePen: number) => {
        if (!user?.tenantId) return;
        setIsProcessingPayment(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-mp-preference', {
                body: {
                    planDuration: months,
                    pricePen: pricePen,
                    tenantId: user.tenantId
                }
            });

            if (error) throw error;
            if (!data || !data.init_point) throw new Error("No se recibió link de pago");

            // Redirigir a Mercado Pago
            window.location.href = data.init_point;

        } catch (err: any) {
            console.error("Error creating MP preference:", err);
            toast.error("No se pudo conectar con el sistema de pagos. " + err.message);
            setIsProcessingPayment(false);
        }
    };

    return (
        <Layout>
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

                {/* Planes de Suscripción Automática */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6 sm:mt-8"
                >
                    <div className="col-span-full mb-2">
                        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 font-display">
                            <CreditCard className="h-5 w-5 text-primary" /> Selecciona tu Plan
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Pago 100% seguro a través de Mercado Pago. La activación es automática.
                        </p>
                    </div>

                    {[
                        {
                            months: 1,
                            name: "Básico",
                            price: 35,
                            popular: false,
                            icon: Zap,
                            description: "Ideal para empezar.",
                            features: ["Acceso completo al sistema", "Soporte estándar", "Actualizaciones incluidas"]
                        },
                        {
                            months: 3,
                            name: "Trimestral",
                            price: 89,
                            oldPrice: 105,
                            popular: false,
                            icon: Rocket,
                            description: "Compromiso a corto plazo.",
                            features: ["Acceso completo al sistema", "Soporte estándar", "Ahorra S/ 16"]
                        },
                        {
                            months: 6,
                            name: "Semestral",
                            price: 159,
                            oldPrice: 210,
                            popular: true,
                            icon: Crown,
                            description: "La opción más elegida.",
                            features: ["Acceso completo al sistema", "Soporte prioritario", "Ahorra S/ 51"]
                        },
                        {
                            months: 12,
                            name: "Anual",
                            price: 279,
                            oldPrice: 420,
                            popular: false,
                            icon: Diamond,
                            description: "Máximo ahorro asegurado.",
                            features: ["Acceso completo al sistema", "Soporte VIP 24/7", "Ahorra S/ 141"]
                        }
                    ].map((plan, index) => (
                        <motion.div
                            key={plan.months}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.3 + (index * 0.1) }}
                            className="flex"
                        >
                            <Card className={`relative overflow-hidden w-full flex flex-col border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.popular ? 'border-primary shadow-lg shadow-primary/20 ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/50'}`}>
                                {plan.popular && (
                                    <div className="absolute top-0 inset-x-0 bg-primary/90 text-primary-foreground text-[10px] sm:text-xs font-bold text-center py-1 sm:py-1.5 uppercase tracking-wider glow-volt">
                                        Más popular
                                    </div>
                                )}
                                <CardContent className={`p-4 sm:p-8 flex flex-col h-full ${plan.popular ? 'pt-8 sm:pt-12' : ''}`}>
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`p-3 rounded-2xl mb-4 ${plan.popular ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                            <plan.icon className="h-6 w-6" />
                                        </div>
                                        <h4 className="text-xl sm:text-2xl font-bold font-display">{plan.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                                        <div className="mt-3 sm:mt-4 mb-1 relative flex items-baseline justify-center gap-1">
                                            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">S/</span>
                                            <span className="text-3xl sm:text-5xl font-black text-foreground drop-shadow-sm">{plan.price}</span>
                                        </div>
                                        {plan.oldPrice ? (
                                            <div className="text-xs text-muted-foreground mb-4">
                                                Normalmente <span className="line-through">S/ {plan.oldPrice}</span>
                                            </div>
                                        ) : (
                                            <div className="mb-4 h-4" />
                                        )}
                                    </div>

                                    <div className="flex-1 mt-1 sm:mt-2 mb-4 sm:mb-6 space-y-2 sm:space-y-3">
                                        {plan.features.map((feat, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                                                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
                                                <span className="text-left leading-tight">{feat}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={() => handleBuySubscription(plan.months, plan.price)}
                                        disabled={isProcessingPayment}
                                        className={`w-full mt-auto font-semibold transition-all shadow-md ${plan.popular ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20' : 'bg-secondary hover:bg-secondary/80 text-foreground'}`}
                                    >
                                        {isProcessingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Renovar ${plan.months} Mes${plan.months > 1 ? 'es' : ''}`}
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
        </Layout>
    );
}

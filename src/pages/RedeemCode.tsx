import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { useState } from "react";
import { Ticket, CheckCircle2, AlertCircle, Loader2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const RedeemCode = () => {
    const [code, setCode] = useState("");
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [redeemed, setRedeemed] = useState(false);
    const { redeemMembershipCode } = useSubscription();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const handleRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) {
            toast.error("Por favor ingresa un código válido");
            return;
        }

        setIsRedeeming(true);

        const success = await redeemMembershipCode(code);

        setIsRedeeming(false);
        if (success) {
            setRedeemed(true);
            queryClient.invalidateQueries({ queryKey: ['affiliate_credits'] });
            toast.success("¡Código canjeado con éxito! Plataforma desbloqueada.");
        } else {
            toast.error("Código inválido. Por favor intenta de nuevo.");
        }
    };

    // Fetch affiliate credits for this user
    const { data: affiliateData } = useQuery({
        queryKey: ['affiliate_credits', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase
                .from('affiliates')
                .select('id, credits_balance, status')
                .eq('profile_id', user.id)
                .eq('status', 'active')
                .single();
            return data;
        },
        enabled: !!user?.id
    });

    const CREDITS_PER_MONTH = 100;

    const redeemCredits = useMutation({
        mutationFn: async () => {
            const balance = affiliateData?.credits_balance || 0;
            if (!affiliateData || balance < CREDITS_PER_MONTH) {
                throw new Error(`Necesitas ${CREDITS_PER_MONTH} créditos para canjear 1 mes. Tienes ${balance}.`);
            }

            // Descontar 100 créditos
            const { error } = await supabase
                .from('affiliates')
                .update({ credits_balance: balance - CREDITS_PER_MONTH })
                .eq('id', affiliateData.id);
            if (error) throw error;

            // Registrar el canje
            await supabase.from('affiliate_credit_redemptions').insert({
                affiliate_profile_id: user!.id,
                credits_used: CREDITS_PER_MONTH,
                months_added: 1
            });

            // Extender la licencia activa en 1 mes
            if (user?.tenantId) {
                const { data: lic } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('redeemed_by', user.tenantId)
                    .eq('status', 'redeemed')
                    .order('redeemed_at', { ascending: false })
                    .limit(1)
                    .single();
                if (lic) {
                    await supabase.from('licenses').update({
                        duration_months: (lic.duration_months || 1) + 1
                    }).eq('id', lic.id);
                }
            }
            return 1;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['affiliate_credits'] });
            toast.success('¡1 mes extra agregado a tu suscripción!');
        },
        onError: (e: any) => toast.error(e.message)
    });

    const credits = affiliateData?.credits_balance || 0;
    const monthsAvailable = Math.floor(credits / CREDITS_PER_MONTH);
    const isActiveAffiliate = !!affiliateData;

    return (
        <Layout>
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h1 className="font-display text-2xl text-foreground">Canje de Código</h1>
                    <p className="text-sm text-muted-foreground">Ingresa tu código promocional o de membresía para activarlo</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    className="rounded-xl border border-border/50 bg-card p-8 shadow-sm"
                >
                    {redeemed ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground">¡Canje Exitoso!</h2>
                                <p className="text-muted-foreground">Tu membresía ha sido activada correctamente.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setRedeemed(false);
                                    setCode("");
                                }}
                                className="mt-4 text-sm font-medium text-primary hover:underline"
                            >
                                Canjear otro código
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleRedeem} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="code" className="text-sm font-medium text-foreground">
                                    Código de Membresía
                                </label>
                                <div className="relative">
                                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        id="code"
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="INTRODUCE TU CÓDIGO AQUÍ"
                                        className="w-full h-12 rounded-lg border border-border/50 bg-secondary/30 pl-10 pr-4 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Asegúrate de escribir el código exactamente como aparece.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isRedeeming}
                                className={cn(
                                    "w-full h-12 rounded-lg py-2.5 text-sm font-semibold transition-smooth flex items-center justify-center gap-2",
                                    isRedeeming
                                        ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                        : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                                )}
                            >
                                {isRedeeming ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Validando...
                                    </>
                                ) : (
                                    "Canjear Código"
                                )}
                            </button>

                            <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Nota Importante</h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        Si el código no funciona, contacta con recepción o con el soporte técnico de KALLPA. Cada código es de un solo uso.
                                    </p>
                                </div>
                            </div>
                        </form>
                    )}
                </motion.div>

                {/* Créditos de Afiliado */}
                {isActiveAffiliate && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm space-y-5"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Gift className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Créditos de Afiliado</h3>
                                    <p className="text-xs text-muted-foreground">100 créditos = 1 mes extra gratis</p>
                                </div>
                            </div>
                            <div className="text-center px-4 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                                <p className="text-2xl font-black font-display text-primary leading-none">{credits}</p>
                                <p className="text-[10px] text-primary/70 uppercase font-bold">créditos</p>
                            </div>
                        </div>

                        {/* Barra de progreso hacia el próximo mes */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{credits % 100}/100 para el próximo mes</span>
                                {monthsAvailable > 0 && (
                                    <span className="text-primary font-semibold">{monthsAvailable} mes{monthsAvailable > 1 ? 'es' : ''} disponible{monthsAvailable > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${Math.min((credits % 100), 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Escala de créditos */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {[{ dur: '1 mes', cr: 10 }, { dur: '3 meses', cr: 25 }, { dur: '6 meses', cr: 50 }, { dur: '12 meses', cr: 100 }].map(({ dur, cr }) => (
                                <div key={dur} className="rounded-lg bg-secondary/30 py-2 px-1">
                                    <p className="text-xs font-bold text-foreground">+{cr}</p>
                                    <p className="text-[10px] text-muted-foreground">{dur}</p>
                                </div>
                            ))}
                        </div>

                        {/* Botón de canje */}
                        <button
                            onClick={() => redeemCredits.mutate()}
                            disabled={credits < 100 || redeemCredits.isPending}
                            className={cn(
                                "w-full rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                credits >= 100
                                    ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                                    : "bg-secondary/40 text-muted-foreground cursor-not-allowed opacity-50"
                            )}
                        >
                            {redeemCredits.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Canjeando...</>
                            ) : (
                                <>Canjear 1 mes gratis <span className="opacity-60 text-xs">(100 créditos)</span></>
                            )}
                        </button>

                        {credits < 100 && (
                            <p className="text-xs text-muted-foreground italic text-center">
                                Te faltan {100 - (credits % 100)} créditos. Invita más gimnasios con tu código de embajador.
                            </p>
                        )}
                    </motion.div>
                )}
            </div>
        </Layout>
    );
};

export default RedeemCode;

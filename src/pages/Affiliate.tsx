import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { useState } from "react";
import {
    Gift, Copy, Share2, Loader2, Smartphone, Facebook, MessageCircle, Twitter,
    Users, CheckCircle2, Star, ChevronRight, Coins
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const Affiliate = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [requestSent, setRequestSent] = useState(false);
    const [referralCodeInput, setReferralCodeInput] = useState("");

    const { data: affiliateData, isLoading } = useQuery({
        queryKey: ['affiliate_full', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data: profile } = await supabase
                .from('profiles')
                .select('referred_by, created_at')
                .eq('id', user.id)
                .single();

            const hasReferredBy = !!profile?.referred_by;
            const daysSinceRegistration = profile ? (new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
            const canEnterReferralCode = !hasReferredBy && daysSinceRegistration <= 7;

            const { data: aff, error: affErr } = await supabase
                .from('affiliates')
                .select('*')
                .eq('profile_id', user.id)
                .single();

            if (!aff) return { isAffiliate: false, status: null, credits: 0, canEnterReferralCode };

            // Stats: referidos y activaciones
            const { data: invites } = await supabase
                .from('profiles')
                .select('id, tenant_id')
                .eq('referred_by', aff.id);

            const numInvites = invites?.length || 0;
            let activated = 0;
            if (invites && invites.length > 0) {
                const tenantIds = invites.map((i) => i.tenant_id).filter(Boolean);
                if (tenantIds.length > 0) {
                    const { data: lics } = await supabase
                        .from('licenses')
                        .select('redeemed_by')
                        .in('redeemed_by', tenantIds)
                        .eq('status', 'redeemed');
                    activated = lics?.length || 0;
                }
            }

            // Credit logs
            const { data: logs } = await supabase
                .from('affiliate_credit_logs')
                .select('*')
                .eq('affiliate_profile_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            return {
                isAffiliate: true,
                status: aff.status,
                code: aff.code,
                credits: aff.credits_balance || 0,
                registered: numInvites,
                activated,
                logs: logs || [],
                canEnterReferralCode,
            };
        },
        enabled: !!user?.id,
    });

    const requestAffiliate = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error("Sin usuario");
            const randomCode = `GYM-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const { error } = await supabase.from('affiliates').insert({
                profile_id: user.id,
                code: randomCode,
                status: 'pending',
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['affiliate_full'] });
            setRequestSent(true);
            toast.success("¡Solicitud enviada! El administrador la revisará pronto.");
        },
        onError: (e: any) => toast.error(e.message),
    });

    const redeemCredits = useMutation({
        mutationFn: async (months: number) => {
            if (!affiliateData || affiliateData.credits < months)
                throw new Error("No tienes suficientes créditos");

            if (!user?.tenantId) {
                throw new Error("No estás conectado a ningún panel.");
            }

            const { error: rpcError } = await supabase.rpc('redeem_affiliate_credits', {
                p_months: months,
                p_tenant_id: user.tenantId
            });

            if (rpcError) throw rpcError;

            return months;
        },
        onSuccess: (months) => {
            queryClient.invalidateQueries({ queryKey: ['affiliate_full'] });
            toast.success(`¡+${months} mes${months > 1 ? 'es' : ''} agregado${months > 1 ? 's' : ''} a tu suscripción!`);
        },
        onError: (e: any) => toast.error(e.message),
    });

    const submitReferralCode = useMutation({
        mutationFn: async (code: string) => {
            if (!user?.id) throw new Error("Sin usuario");
            if (!code.trim()) throw new Error("Ingresa un código");

            // Buscar afiliado
            const { data: aff, error: affError } = await supabase
                .from('affiliates')
                .select('id, profile_id')
                .eq('code', code.trim().toUpperCase())
                .single();

            if (affError || !aff) throw new Error("Código de referido no válido");
            if (aff.profile_id === user.id) throw new Error("No puedes usar tu propio código");

            // Actualizar perfil
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ referred_by: aff.id })
                .eq('id', user.id);

            if (updateError) throw new Error(updateError.message);
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['affiliate_full'] });
            toast.success("¡Código de referido aplicado exitosamente!");
            setReferralCodeInput("");
        },
        onError: (e: any) => toast.error(e.message),
    });

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    const shareWhatsApp = () => {
        const msg = `¡Eleva la gestión de tu gimnasio con KALLPA! Úsame como referido al registrarte y actívate con mi código: ${affiliateData?.code} 💪 👉 https://kallpa.site/`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    if (isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </Layout>
        );
    }

    const renderReferralCodeSection = () => {
        if (!affiliateData?.canEnterReferralCode) return null;

        return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4 mb-8"
            >
                <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">¿Te refirió otro gimnasio?</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Ingresa su código de embajador. (Solo disponible en tus primeros 7 días)
                </p>
                <div className="flex gap-3 max-w-sm">
                    <Input
                        placeholder="Ej. GYM-A1B2"
                        value={referralCodeInput}
                        onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                        className="uppercase bg-background"
                        disabled={submitReferralCode.isPending}
                    />
                    <Button
                        onClick={() => submitReferralCode.mutate(referralCodeInput)}
                        disabled={submitReferralCode.isPending || !referralCodeInput.trim()}
                    >
                        {submitReferralCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Aplicar
                    </Button>
                </div>
            </motion.div>
        );
    };

    // === NOT AN AFFILIATE YET ===
    if (!affiliateData?.isAffiliate) {
        return (
            <Layout>
                <div className="max-w-2xl mx-auto space-y-8">
                    <div>
                        <h1 className="font-display text-2xl text-foreground">Programa de Afiliados</h1>
                        <p className="text-sm text-muted-foreground">Invita gimnasios, gana meses gratis</p>
                    </div>

                    {renderReferralCodeSection()}

                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-6"
                    >
                        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Gift className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-foreground">Conviértete en Embajador</h2>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                Recibe un código único para invitar a otros dueños de gimnasio. Cada vez que uno de tus referidos active su suscripción, ganas <span className="text-primary font-semibold">1 mes gratis</span> de KALLPA.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-center text-xs text-muted-foreground">
                            {[
                                { icon: Share2, label: "Comparte tu código" },
                                { icon: Users, label: "Ellos se registran" },
                                { icon: Coins, label: "Ganas meses gratis" },
                            ].map(({ icon: Icon, label }) => (
                                <div key={label} className="space-y-2">
                                    <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <p>{label}</p>
                                </div>
                            ))}
                        </div>

                        {requestSent ? (
                            <div className="flex items-center justify-center gap-2 text-success font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                Solicitud enviada — pendiente de aprobación
                            </div>
                        ) : (
                            <Button
                                onClick={() => requestAffiliate.mutate()}
                                disabled={requestAffiliate.isPending}
                                className="bg-primary text-primary-foreground hover:opacity-90 px-8"
                            >
                                {requestAffiliate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
                                Solicitar ser Embajador
                            </Button>
                        )}
                    </motion.div>
                </div>
            </Layout>
        );
    }

    // === PENDING APPROVAL ===
    if (affiliateData?.status === 'pending') {
        return (
            <Layout>
                <div className="max-w-2xl mx-auto space-y-8">
                    <div>
                        <h1 className="font-display text-2xl text-foreground">Programa de Afiliados</h1>
                        <p className="text-sm text-muted-foreground">Tu solicitud está en revisión</p>
                    </div>

                    {renderReferralCodeSection()}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-border/50 bg-card p-8 text-center space-y-4"
                    >
                        <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mx-auto" />
                        <h2 className="text-lg font-semibold text-foreground">Solicitud en Revisión</h2>
                        <p className="text-sm text-muted-foreground">El administrador evaluará tu postulación. Recibirás tu código de embajador pronto.</p>
                    </motion.div>
                </div>
            </Layout>
        );
    }

    // === ACTIVE AFFILIATE DASHBOARD ===
    const credits = affiliateData.credits || 0;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="font-display text-2xl text-foreground">Panel de Embajador</h1>
                    <p className="text-sm text-muted-foreground">Gestiona tu código, créditos y canjes</p>
                </div>

                {renderReferralCodeSection()}

                {/* Stats Row */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-4"
                >
                    {[
                        { label: "Registrados", value: affiliateData.registered, color: "text-foreground" },
                        { label: "Activados", value: affiliateData.activated, color: "text-success" },
                        { label: "Créditos", value: credits, color: "text-primary" },
                    ].map(({ label, value, color }) => (
                        <Card key={label} className="border-border/50 bg-card/50 text-center py-5">
                            <p className={`text-4xl font-display font-black ${color}`}>{value}</p>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">{label}</p>
                        </Card>
                    ))}
                </motion.div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Código de Embajador */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <Card className="border-border/50 bg-card/50 h-full">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Star className="h-4 w-4 text-primary" /> Tu Código de Embajador
                                </CardTitle>
                                <CardDescription>Compártelo con dueños de gimnasio para ganar créditos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div
                                    onClick={() => copyToClipboard(affiliateData.code)}
                                    className="p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all group text-center"
                                >
                                    <p className="text-[10px] text-primary/60 uppercase font-bold tracking-widest mb-1">Código de Invitación</p>
                                    <p className="text-2xl font-mono font-black text-primary flex items-center justify-center gap-3 uppercase">
                                        {affiliateData.code}
                                        <Copy className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </p>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full text-sm border-border/50">
                                            <Share2 className="h-4 w-4 mr-2" /> Compartir por...
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-52">
                                        <DropdownMenuItem onClick={shareWhatsApp} className="cursor-pointer hover:!text-[#25D366]">
                                            <Smartphone className="h-4 w-4 mr-2" /> WhatsApp
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => window.open(`https://www.facebook.com/dialog/share?app_id=123456&display=popup&href=https://kallpa.site/&quote=${encodeURIComponent(`Código: ${affiliateData.code}`)}`, '_blank')}
                                            className="cursor-pointer hover:!text-[#1877F2]"
                                        >
                                            <Facebook className="h-4 w-4 mr-2" /> Facebook
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Usa mi código ${affiliateData.code} en KALLPA 💪 https://kallpa.site/`)}`, '_blank')}
                                            className="cursor-pointer"
                                        >
                                            <Twitter className="h-4 w-4 mr-2" /> X (Twitter)
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => copyToClipboard(`https://kallpa.site/?ref=${affiliateData.code}`)} className="cursor-pointer">
                                            <Copy className="h-4 w-4 mr-2" /> Copiar enlace
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Canjear Créditos */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="border-border/50 bg-card/50 h-full">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-primary" /> Canjear Créditos
                                </CardTitle>
                                <CardDescription>1 crédito = 1 mes extra de suscripción en tu gimnasio</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                                    <span className="text-sm text-muted-foreground">Saldo actual</span>
                                    <span className="text-3xl font-black font-display text-primary">{credits} <span className="text-sm font-normal">créditos</span></span>
                                </div>

                                {credits > 0 ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        {[1, 3, 6].map((months) => {
                                            const canRedeem = credits >= months;
                                            return (
                                                <button
                                                    key={months}
                                                    onClick={() => redeemCredits.mutate(months)}
                                                    disabled={!canRedeem || redeemCredits.isPending}
                                                    className={cn(
                                                        "rounded-xl border py-4 px-2 text-center transition-all",
                                                        canRedeem
                                                            ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/15 active:scale-95"
                                                            : "border-border/30 text-muted-foreground bg-secondary/20 opacity-40 cursor-not-allowed"
                                                    )}
                                                >
                                                    {redeemCredits.isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                    ) : (
                                                        <>
                                                            <span className="block text-2xl font-black">+{months}</span>
                                                            <span className="text-[11px]">mes{months > 1 ? 'es' : ''}</span>
                                                        </>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 space-y-2">
                                        <p className="text-sm text-muted-foreground">Aún no tienes créditos.</p>
                                        <p className="text-xs text-muted-foreground">Cuando un referido tuyo active su suscripción, recibirás 1 crédito automáticamente.</p>
                                    </div>
                                )}

                                <div className="space-y-2 pt-2">
                                    {[
                                        "Invita a un dueño de gimnasio con tu código",
                                        "Ellos se registran en sus primeros 7 días",
                                        "Activan su primera suscripción → tú ganas 1 crédito",
                                    ].map((step, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <span className="min-w-5 min-h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-black text-primary mt-0.5">{i + 1}</span>
                                            <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Historial de créditos */}
                {affiliateData.logs && affiliateData.logs.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <Card className="border-border/50 bg-card/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 text-primary" /> Últimos Créditos Ganados
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {affiliateData.logs.map((log: any) => (
                                        <div key={log.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                                            <p className="text-xs text-muted-foreground">{log.reason}</p>
                                            <span className="text-sm font-bold text-success">+{log.amount} crédito</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>
        </Layout>
    );
};

export default Affiliate;

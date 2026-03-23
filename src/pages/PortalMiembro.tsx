import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import {
    CheckCircle2, XCircle, Dumbbell, Download, Loader2,
    AlertCircle, Calendar, Clock, ArrowLeft, Sparkles, Zap, Smartphone,
    CreditCard, Tag, ShoppingCart, CalendarDays, User, Users, CheckCheck
} from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, addDays, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string; shadow: string }> = {
    active: { label: "ACTIVO", icon: CheckCircle2, color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", shadow: "0 0 20px rgba(16, 185, 129, 0.2)" },
    expired: { label: "VENCIDO", icon: XCircle, color: "#f43f5e", bg: "rgba(244, 63, 94, 0.1)", shadow: "0 0 20px rgba(244, 63, 94, 0.2)" },
    suspended: { label: "SUSPENDIDO", icon: AlertCircle, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", shadow: "0 0 20px rgba(245, 158, 11, 0.2)" },
    inactive: { label: "INACTIVO", icon: XCircle, color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", shadow: "0 0 20px rgba(148, 163, 184, 0.2)" },
};

export default function PortalMiembro() {
    const { memberId } = useParams<{ memberId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState<"portal" | "carnet" | "renovar" | "clases">("portal");
    const [scrolled, setScrolled] = useState(false);
    const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Manejar retorno desde Mercado Pago con ?payment=success/failure/pending
    useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        const planName = searchParams.get('plan');
        if (!paymentStatus) return;
        if (paymentStatus === 'success') {
            toast.success(`¡Pago exitoso! Tu membresía${planName ? ` "${planName}"` : ''} ha sido renovada.`, { duration: 6000 });
        } else if (paymentStatus === 'failure') {
            toast.error('El pago no pudo procesarse. Intenta de nuevo o elige otro método.');
        } else if (paymentStatus === 'pending') {
            toast.info('Tu pago está en proceso. Te avisaremos cuando se confirme.');
        }
        setActiveTab('renovar');
        setSearchParams({}, { replace: true });
    }, [searchParams]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["portal_member", memberId],
        queryFn: async () => {
            if (!memberId) throw new Error("Sin ID");

            const { data: member, error } = await supabase
                .from("members")
                .select("id, full_name, status, plan, phone, access_code, start_date, end_date, created_at, tenant_id")
                .eq("id", memberId)
                .single();

            if (error || !member) throw new Error("Miembro no encontrado");

            let planName = "Membresía Activa";
            let planColor = "#7C3AED";
            let planPrice = 0;
            let planDays = 30;
            let gymWhatsApp = "";
            let gymName = "KALLPA GYM";

            if (member.plan) {
                const { data: plan } = await supabase
                    .from("membership_plans")
                    .select("name, color, price, duration_days")
                    .eq("id", member.plan)
                    .maybeSingle();
                if (plan) {
                    planName = plan.name;
                    planColor = plan.color || "#7C3AED";
                    planPrice = plan.price;
                    planDays = plan.duration_days;
                }
            }

            let gymHasMp = false;

            if (member.tenant_id) {
                const { data: gs } = await supabase
                    .from("gym_settings")
                    .select("whatsapp_number, gym_name, mp_access_token")
                    .eq("tenant_id", member.tenant_id)
                    .maybeSingle();
                if (gs?.whatsapp_number) gymWhatsApp = gs.whatsapp_number;
                if (gs?.gym_name) gymName = gs.gym_name;
                // Solo necesitamos saber si existe el token, no el valor en sí
                gymHasMp = !!(gs?.mp_access_token);
            }

            return { ...member, planName, planColor, planPrice, planDays, gymWhatsApp, gymName, gymHasMp };
        },
        enabled: !!memberId,
        staleTime: 1000 * 60 * 5,    // 5 min — evita 3 sub-queries en cada cambio de tab
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    });

    /** Carga los planes activos del gym del miembro para mostrarlos en la sección de renovación. */
    const { data: activePlans = [] } = useQuery({
        queryKey: ["portal_plans", data?.tenant_id],
        queryFn: async () => {
            if (!data?.tenant_id) return [];
            const { data: plans } = await supabase
                .from("membership_plans")
                .select("id, name, price, duration_days, color, description")
                .eq("tenant_id", data.tenant_id)
                .eq("is_active", true)
                .order("price", { ascending: true });
            return plans || [];
        },
        enabled: !!data?.tenant_id,
        staleTime: 1000 * 60 * 5,
    });

    /**
     * Inicia el pago de una membresía desde el portal público.
     * Llama a la Edge Function `create-member-payment` con el anon key (no requiere auth).
     * Si la preferencia se crea correctamente, redirige al checkout de Mercado Pago.
     */
    const handlePayPlan = async (planId: string) => {
        if (!memberId) return;
        setPayingPlanId(planId);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
            const response = await fetch(`${supabaseUrl}/functions/v1/create-member-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                },
                body: JSON.stringify({ memberId, planId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al iniciar el pago');
            if (result.init_point) {
                window.location.href = result.init_point;
            }
        } catch (err: any) {
            toast.error(err.message || 'No se pudo iniciar el pago. Intenta de nuevo.');
        } finally {
            setPayingPlanId(null);
        }
    };

    /** Carga los horarios semanales activos del gym para mostrar en el tab de clases. */
    const { data: classSchedules = [] } = useQuery({
        queryKey: ["portal_class_schedules", data?.tenant_id],
        queryFn: async () => {
            if (!data?.tenant_id) return [];
            const { data: schedules } = await supabase
                .from("class_schedules")
                .select("*, classes(*)")
                .eq("tenant_id", data.tenant_id)
                .eq("is_active", true)
                .order("start_time", { ascending: true });
            return schedules || [];
        },
        enabled: !!data?.tenant_id,
        staleTime: 1000 * 60 * 5,
    });

    /** Reservas del miembro para los próximos 14 días. */
    const { data: myReservations = [] } = useQuery({
        queryKey: ["portal_my_reservations", memberId],
        queryFn: async () => {
            if (!memberId) return [];
            const todayStr = startOfToday().toISOString().split("T")[0];
            const { data: reservations } = await supabase
                .from("class_reservations")
                .select("schedule_id, session_date, status")
                .eq("member_id", memberId)
                .gte("session_date", todayStr);
            return reservations || [];
        },
        enabled: !!memberId,
        staleTime: 0,
    });

    /** Conteo de reservas confirmadas por session (schedule_id + session_date) para calcular cupos. */
    const { data: sessionCounts = [] } = useQuery({
        queryKey: ["portal_session_counts", data?.tenant_id],
        queryFn: async () => {
            if (!data?.tenant_id) return [];
            const todayStr = startOfToday().toISOString().split("T")[0];
            const { data: counts } = await supabase
                .from("class_reservations")
                .select("schedule_id, session_date")
                .eq("tenant_id", data.tenant_id)
                .eq("status", "confirmed")
                .gte("session_date", todayStr);
            return counts || [];
        },
        enabled: !!data?.tenant_id,
        staleTime: 0,
    });

    /**
     * Calcula las próximas sesiones para los siguientes 7 días a partir de hoy,
     * cruzando el horario semanal con los conteos de reservas y las reservas del miembro.
     */
    const upcomingSessions = useMemo(() => {
        const today = startOfToday();
        const sessions: any[] = [];
        for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const dow = date.getDay(); // 0=Dom, 1=Lun ... 6=Sáb
            const dateStr = date.toISOString().split("T")[0];
            const daySchedules = classSchedules.filter((s: any) => s.day_of_week === dow);
            for (const schedule of daySchedules) {
                const count = sessionCounts.filter(
                    (r: any) => r.schedule_id === schedule.id && r.session_date === dateStr
                ).length;
                const isReserved = myReservations.some(
                    (r: any) => r.schedule_id === schedule.id && r.session_date === dateStr && r.status === "confirmed"
                );
                sessions.push({
                    ...schedule,
                    date,
                    dateStr,
                    reservedCount: count,
                    spotsLeft: (schedule.classes?.capacity || 0) - count,
                    isReserved,
                });
            }
        }
        return sessions;
    }, [classSchedules, sessionCounts, myReservations]);

    const queryClient = useQueryClient();

    /** Confirma la reserva del miembro para una sesión específica. */
    const reserveMutation = useMutation({
        mutationFn: async ({ scheduleId, sessionDate, tenantId }: { scheduleId: string; sessionDate: string; tenantId: string }) => {
            const { error } = await supabase.from("class_reservations").insert({
                tenant_id: tenantId,
                schedule_id: scheduleId,
                member_id: memberId,
                session_date: sessionDate,
                status: "confirmed",
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["portal_my_reservations", memberId] });
            queryClient.invalidateQueries({ queryKey: ["portal_session_counts", data?.tenant_id] });
            toast.success("¡Reserva confirmada!");
        },
        onError: (e: any) => toast.error(e.message || "No se pudo reservar"),
    });

    /** Cancela la reserva del miembro para una sesión. */
    const cancelMutation = useMutation({
        mutationFn: async ({ scheduleId, sessionDate }: { scheduleId: string; sessionDate: string }) => {
            const { error } = await supabase.from("class_reservations")
                .delete()
                .eq("schedule_id", scheduleId)
                .eq("member_id", memberId!)
                .eq("session_date", sessionDate);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["portal_my_reservations", memberId] });
            queryClient.invalidateQueries({ queryKey: ["portal_session_counts", data?.tenant_id] });
            toast.success("Reserva cancelada");
        },
        onError: (e: any) => toast.error(e.message || "No se pudo cancelar"),
    });

    const downloadCard = async () => {
        if (!cardRef.current) return;
        setDownloading(true);
        try {
            await new Promise<void>((resolve, reject) => {
                if ((window as any).html2canvas) { resolve(); return; }
                const s = document.createElement("script");
                s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
                s.onload = () => resolve();
                s.onerror = reject;
                document.head.appendChild(s);
            });
            const canvas = await (window as any).html2canvas(cardRef.current, {
                backgroundColor: null, scale: 3, useCORS: true,
            });
            const link = document.createElement("a");
            link.download = `carnet-${data?.full_name?.replace(/\s+/g, "-").toLowerCase()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("¡Carnet digital descargado!");
        } catch {
            toast.error("Hubo un problema. Por favor toma una captura.");
        } finally {
            setDownloading(false);
        }
    };

    const handleRenewal = () => {
        if (!data) return;
        const phone = data.gymWhatsApp?.replace(/\D/g, "") || "";
        // Fallback: si el gym no configuró WhatsApp, mostrar aviso en lugar de abrir WA sin número
        if (!phone) {
            toast.info("Contacta directamente a la recepción de tu gimnasio para renovar.");
            return;
        }
        const msg = `¡Hola! Soy ${data.full_name}. Mi membresía "${data.planName}" está por vencer y me gustaría renovarla. 🎉`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    if (isLoading) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                </div>
                <p className="text-primary/60 text-sm font-medium animate-pulse">Cargando tu experiencia KALLPA...</p>
            </div>
        </div>
    );

    if (isError || !data) return (
        <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center gap-6 p-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white">Oops! No te encontramos</h1>
                <p className="text-white/40 max-w-[250px]">Parece que el enlace es incorrecto o el miembro ya no existe.</p>
            </div>
            <Link to="/portal" className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Volver al portal
            </Link>
        </div>
    );

    const today = new Date();
    const endDate = data.end_date ? parseISO(data.end_date) : null;
    const startDate = data.start_date ? parseISO(data.start_date) : parseISO(data.created_at);
    const totalDays = endDate && startDate ? differenceInDays(endDate, startDate) : data.planDays;
    const daysLeft = endDate ? Math.max(0, differenceInDays(endDate, today)) : null;
    const daysUsed = startDate ? differenceInDays(today, startDate) : 0;
    const progress = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((daysUsed / totalDays) * 100))) : 0;
    const isExpired = endDate ? !isAfter(endDate, today) : false;

    let currentStatus = data.status ?? "active";
    if (isExpired && currentStatus === "active") currentStatus = "expired";
    const st = statusConfig[currentStatus] ?? statusConfig.active;
    // QR local con react-qr-code — sin dependencia de servicios externos
    const memberIdShort = data.id.toUpperCase().slice(-8);

    return (
        <div className="min-h-screen bg-[#050508] text-white selection:bg-primary/30 relative overflow-x-hidden">
            {/* --- Background Effects --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
            </div>

            {/* --- Header --- */}
            <header className={cn(
                "fixed top-0 inset-x-0 z-50 px-6 py-4 transition-all duration-300",
                scrolled ? "bg-black/60 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
            )}>
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <Link to="/portal" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-white/60" />
                    </Link>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Gimnasio</span>
                        <span className="text-sm font-bold text-white">{data.gymName}</span>
                    </div>
                    <div className="p-2 -mr-2 opacity-0">
                        <ArrowLeft className="h-5 w-5" />
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 pt-24 pb-20 relative z-10 space-y-8">
                {/* --- Profile Intro --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center gap-4"
                >
                    {/* Perfil */}
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary to-violet-600 p-[2px] shadow-2xl shadow-primary/20">
                            <div className="w-full h-full rounded-[1.9rem] bg-[#0d0d15] flex items-center justify-center overflow-hidden">
                                {(data as any).photo_url ? (
                                    <img
                                        src={(data as any).photo_url}
                                        alt={data.full_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-3xl font-bold bg-gradient-to-br from-primary to-violet-600 bg-clip-text text-transparent">
                                        {data.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#050508] p-1 shadow-lg"
                        >
                            <div className="h-full w-full rounded-full flex items-center justify-center" style={{ backgroundColor: st.color }}>
                                <st.icon className="h-4 w-4 text-white" />
                            </div>
                        </motion.div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{data.full_name}</h1>
                        <p className="text-white/40 text-sm mt-1 flex items-center justify-center gap-1.5 font-medium">
                            <Zap className="h-3.5 w-3.5 text-primary" /> {data.planName}
                        </p>
                    </div>
                </motion.div>

                {/* --- Main Status Card --- */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="group relative rounded-[40px] bg-white/[0.03] border border-white/10 p-8 backdrop-blur-2xl overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Dumbbell className="h-32 w-32 -mr-12 -mt-12 rotate-12" />
                    </div>

                    <div className="relative space-y-8">
                        {/* Days Left Display */}
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <p className="text-[11px] font-bold text-white/30 uppercase tracking-[.2em]">Estado Actual</p>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: st.color }} />
                                    <span className="text-2xl font-bold" style={{ color: st.color }}>{st.label}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                {endDate ? (
                                    <>
                                        <p className="text-4xl font-black tabular-nums leading-none">
                                            {isExpired ? "0" : daysLeft}
                                        </p>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Días restantes</p>
                                    </>
                                ) : (
                                    <p className="text-sm font-bold text-white/40 italic">Ilimitado</p>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="space-y-4">
                            <div className="h-4 w-full bg-white/5 rounded-full p-1 overflow-hidden ring-1 ring-white/10">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1.5, type: "spring" }}
                                    className="h-full rounded-full relative"
                                    style={{
                                        background: isExpired
                                            ? "linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)"
                                            : `linear-gradient(90deg, ${data.planColor} 0%, #a78bfa 100%)`
                                    }}
                                >
                                    {!isExpired && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                                </motion.div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-white/30">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {format(startDate, "dd MMM yyyy", { locale: es })}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {format(endDate || today, "dd MMM yyyy", { locale: es })}
                                    <Clock className="h-3.5 w-3.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* --- Tabs / Actions --- */}
                <div className="space-y-6">
                    <div className="flex p-1.5 bg-white/5 rounded-3xl border border-white/10">
                        <button
                            onClick={() => setActiveTab("portal")}
                            className={cn(
                                "flex-1 py-3 text-[10px] font-bold uppercase tracking-[.12em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5",
                                activeTab === "portal" ? "bg-primary text-black shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                            )}>
                            <Smartphone className="h-3.5 w-3.5" /> Carnet
                        </button>
                        <button
                            onClick={() => setActiveTab("carnet")}
                            className={cn(
                                "flex-1 py-3 text-[10px] font-bold uppercase tracking-[.12em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5",
                                activeTab === "carnet" ? "bg-primary text-black shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                            )}>
                            <Zap className="h-3.5 w-3.5" /> QR Acceso
                        </button>
                        <button
                            onClick={() => setActiveTab("renovar")}
                            className={cn(
                                "flex-1 py-3 text-[10px] font-bold uppercase tracking-[.12em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5",
                                activeTab === "renovar" ? "bg-primary text-black shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                            )}>
                            <CreditCard className="h-3.5 w-3.5" /> Renovar
                        </button>
                        {classSchedules.length > 0 && (
                            <button
                                onClick={() => setActiveTab("clases")}
                                className={cn(
                                    "flex-1 py-3 text-[10px] font-bold uppercase tracking-[.12em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-1.5",
                                    activeTab === "clases" ? "bg-primary text-black shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                                )}>
                                <CalendarDays className="h-3.5 w-3.5" /> Clases
                            </button>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === "portal" && (
                            <motion.div
                                key="card-view"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="space-y-4"
                            >
                                {/* Premium Card Design */}
                                <div
                                    ref={cardRef}
                                    className="relative aspect-[16/10] w-full rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-8 group/card"
                                    style={{ background: "linear-gradient(135deg, #0d0d15 0%, #1a1a2e 50%, #0d0d15 100%)" }}
                                >
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-x-0 top-0 h-[200%] w-full bg-gradient-to-b from-white/5 via-transparent to-transparent -rotate-45 -translate-y-[50%] animate-shimmer pointer-events-none" />

                                    <div className="flex justify-between items-start relative z-10 mb-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black tracking-[0.3em] text-primary uppercase">Membresía KALLPA</p>
                                            <h3 className="text-xl font-bold text-white uppercase leading-none">{data.gymName}</h3>
                                        </div>
                                        <div className="h-10 w-14 bg-gradient-to-br from-white/20 to-transparent rounded-lg border border-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
                                            <Sparkles className="h-5 w-5 text-amber-400" />
                                        </div>
                                    </div>

                                    <div className="mt-auto relative z-10 flex items-end justify-between gap-4">
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase">Titular del Pase</p>
                                                <p className="text-2xl font-bold tracking-tight text-white leading-tight truncate">{data.full_name}</p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div>
                                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">ID Miembro</p>
                                                    <p className="text-sm font-mono font-bold text-primary">#{memberIdShort}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Plan Activo</p>
                                                    <p className="text-sm font-bold text-white/90">{data.planName}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0 p-1.5 bg-white rounded-2xl shadow-[0_0_25px_rgba(255,255,255,0.15)] ring-1 ring-black/5 flex items-center justify-center">
                                            <QRCode value={data.id} size={64} level="M" />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={downloadCard}
                                    disabled={downloading}
                                    className="w-full py-5 rounded-[24px] bg-white/[0.05] border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-3 hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                                >
                                    {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-primary" />}
                                    Guardar en mi Galería
                                </button>
                            </motion.div>
                        )}
                        {activeTab === "carnet" && (
                            <motion.div
                                key="qr-view"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="flex flex-col items-center gap-8 py-4"
                            >
                                <div className="text-center space-y-2 max-w-[250px]">
                                    <h3 className="text-lg font-bold">Acceso Terminal</h3>
                                    <p className="text-white/40 text-xs">Muestra este código frente a la cámara del terminal para marcar tu asistencia.</p>
                                </div>
                                <div className="relative group p-10">
                                    <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full scale-75 group-hover:scale-110 transition-transform duration-700" />
                                    <div className="relative bg-white p-8 rounded-[40px] shadow-2xl flex items-center justify-center">
                                        <QRCode value={data.id} size={208} level="M" />
                                        <div className="absolute inset-0 border-[2px] border-black/5 rounded-[40px]" />
                                    </div>
                                    {/* Scan lines decoration */}
                                    <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-primary" />
                                    <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-primary" />
                                    <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-primary" />
                                    <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-primary" />
                                </div>
                                <p className="font-mono text-sm tracking-[.5em] text-primary/60 font-black">#{data.access_code}</p>
                            </motion.div>
                        )}
                        {activeTab === "renovar" && (
                            <motion.div
                                key="renovar-view"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="space-y-4"
                            >
                                {/* Info de membresía actual */}
                                <div className="p-5 rounded-[24px] bg-white/[0.04] border border-white/10 flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Plan actual</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.planColor }} />
                                            <p className="text-sm font-bold text-white">{data.planName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Vence</p>
                                        <p className={cn("text-sm font-bold", isExpired ? "text-red-400" : "text-white/80")}>
                                            {endDate ? format(endDate, "dd MMM yyyy", { locale: es }) : "Ilimitado"}
                                        </p>
                                    </div>
                                </div>

                                {/* Grid de planes disponibles */}
                                {!data.gymHasMp ? (
                                    /* El gym aún no configuró pagos online */
                                    <div className="py-10 flex flex-col items-center gap-4 text-center">
                                        <div className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                            <CreditCard className="h-8 w-8 text-amber-400/70" />
                                        </div>
                                        <div className="space-y-2 max-w-[260px]">
                                            <p className="text-sm font-bold text-white/80">Pagos online no disponibles</p>
                                            <p className="text-xs text-white/40 leading-relaxed">
                                                Este gimnasio aún no tiene activados los pagos en línea.
                                                Para renovar tu membresía, contacta directamente a recepción.
                                            </p>
                                        </div>
                                        {data.gymWhatsApp && (
                                            <a
                                                href={`https://wa.me/${data.gymWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, soy ${data.full_name} y quiero renovar mi membresía "${data.planName}".`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#25D366] text-white font-bold text-sm shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                                Contactar por WhatsApp
                                            </a>
                                        )}
                                    </div>
                                ) : activePlans.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                                        <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center">
                                            <Tag className="h-7 w-7 text-white/20" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white/60">Sin planes disponibles</p>
                                            <p className="text-xs text-white/30 mt-1">Contacta a recepción para renovar tu membresía.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Elige tu plan</p>
                                        {activePlans.map((plan: any) => (
                                            <motion.div
                                                key={plan.id}
                                                whileTap={{ scale: 0.98 }}
                                                className="relative rounded-[20px] bg-white/[0.04] border border-white/10 p-5 overflow-hidden"
                                                style={{ borderColor: plan.id === data.plan ? plan.color + "60" : undefined }}
                                            >
                                                {/* Color accent strip */}
                                                <div className="absolute top-0 left-0 w-1 h-full rounded-l-[20px]" style={{ backgroundColor: plan.color }} />
                                                <div className="pl-3 flex items-center justify-between gap-4">
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-white text-sm">{plan.name}</p>
                                                            {plan.id === data.plan && (
                                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: plan.color + "30", color: plan.color }}>Tu plan</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] text-white/40 flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> {plan.duration_days} días
                                                            </span>
                                                            {plan.description && (
                                                                <span className="text-[11px] text-white/30 truncate max-w-[140px]">{plan.description}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <p className="text-xl font-black" style={{ color: plan.color }}>
                                                            S/{Number(plan.price).toFixed(0)}
                                                        </p>
                                                        <button
                                                            onClick={() => handlePayPlan(plan.id)}
                                                            disabled={payingPlanId !== null}
                                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                                                            style={{ backgroundColor: plan.color }}
                                                        >
                                                            {payingPlanId === plan.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <ShoppingCart className="h-3.5 w-3.5" />
                                                            )}
                                                            Pagar
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                        <p className="text-center text-[10px] text-white/20 pt-2">
                                            Pagos procesados por Mercado Pago · 100% seguro
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                        {activeTab === "clases" && (
                            <motion.div
                                key="clases-view"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="space-y-3"
                            >
                                {upcomingSessions.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                                        <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center">
                                            <CalendarDays className="h-7 w-7 text-white/20" />
                                        </div>
                                        <p className="text-sm font-bold text-white/60">Sin clases esta semana</p>
                                        <p className="text-xs text-white/30">El horario está vacío por ahora.</p>
                                    </div>
                                ) : (() => {
                                    // Agrupar sesiones por día
                                    const grouped: Record<string, typeof upcomingSessions> = {};
                                    for (const s of upcomingSessions) {
                                        if (!grouped[s.dateStr]) grouped[s.dateStr] = [];
                                        grouped[s.dateStr].push(s);
                                    }
                                    return Object.entries(grouped).map(([dateStr, sessions]) => (
                                        <div key={dateStr} className="space-y-2">
                                            {/* Cabecera del día */}
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                                                    {format(sessions[0].date, "EEEE dd 'de' MMMM", { locale: es })}
                                                </p>
                                                <div className="flex-1 h-px bg-white/5" />
                                            </div>
                                            {sessions.map((session) => (
                                                <div
                                                    key={`${session.id}-${session.dateStr}`}
                                                    className="rounded-[18px] border overflow-hidden"
                                                    style={{
                                                        borderColor: (session.classes?.color || "#7C3AED") + (session.isReserved ? "80" : "30"),
                                                        backgroundColor: (session.classes?.color || "#7C3AED") + (session.isReserved ? "15" : "08"),
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3 p-4">
                                                        {/* Hora + color strip */}
                                                        <div className="flex flex-col items-center shrink-0 w-12">
                                                            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: (session.classes?.color || "#7C3AED") + "30" }}>
                                                                <Clock className="h-4 w-4" style={{ color: session.classes?.color || "#7C3AED" }} />
                                                            </div>
                                                            <p className="text-[10px] font-black text-white/50 mt-1 tracking-wider">
                                                                {session.start_time.slice(0, 5)}
                                                            </p>
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="font-bold text-sm text-white truncate">
                                                                {session.classes?.name}
                                                            </p>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                {session.classes?.instructor && (
                                                                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                                                                        <User className="h-3 w-3" /> {session.classes.instructor}
                                                                    </span>
                                                                )}
                                                                <span className={cn(
                                                                    "text-[10px] font-bold flex items-center gap-1",
                                                                    session.spotsLeft <= 0 ? "text-red-400" : session.spotsLeft <= 3 ? "text-amber-400" : "text-white/40"
                                                                )}>
                                                                    <Users className="h-3 w-3" />
                                                                    {session.spotsLeft <= 0 ? "Sin cupos" : `${session.spotsLeft} cupos`}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Botón reservar/cancelar */}
                                                        {session.isReserved ? (
                                                            <button
                                                                onClick={() => cancelMutation.mutate({ scheduleId: session.id, sessionDate: session.dateStr })}
                                                                disabled={cancelMutation.isPending}
                                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-white/60 border border-white/10 hover:border-red-400/40 hover:text-red-400 transition-all active:scale-95"
                                                            >
                                                                {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                                                                Reservado
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    if (session.spotsLeft <= 0) return;
                                                                    reserveMutation.mutate({ scheduleId: session.id, sessionDate: session.dateStr, tenantId: data!.tenant_id });
                                                                }}
                                                                disabled={session.spotsLeft <= 0 || reserveMutation.isPending}
                                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                style={{ backgroundColor: session.spotsLeft > 0 ? (session.classes?.color || "#7C3AED") : undefined }}
                                                            >
                                                                {reserveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                {session.spotsLeft <= 0 ? "Lleno" : "Reservar"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ));
                                })()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- Renovation / Contact --- */}
                <div className="pt-8 flex flex-col gap-4">
                    <div className="p-6 rounded-[32px] bg-gradient-to-br from-primary/10 to-transparent border border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">{isExpired ? "Tu acceso ha finalizado" : "¿Deseas extender tu plan?"}</h4>
                                <p className="text-[11px] text-white/40 font-medium tracking-wide">Contacta a recepción para atención inmediata.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleRenewal}
                            className="w-full py-4 rounded-2xl bg-[#25D366] text-white font-bold text-sm shadow-xl shadow-[#25D366]/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Hablar con Recepción
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 opacity-20 py-4 scale-95">
                        <Dumbbell className="h-4 w-4" />
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase">Powered by KALLPA PRO</span>
                    </div>
                </div>
            </main>

            {/* --- Global Styling --- */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translate(-100%, -100%) rotate(-45deg); opacity: 0; }
                    50% { opacity: 0.1; }
                    100% { transform: translate(100%, 100%) rotate(-45deg); opacity: 0; }
                }
                .animate-shimmer {
                    animation: shimmer 5s infinite;
                }
            `}</style>
        </div>
    );
}

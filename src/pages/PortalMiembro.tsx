import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import {
    CheckCircle2, XCircle, Dumbbell, Download, Loader2,
    AlertCircle, Calendar, Clock, RefreshCw, ArrowLeft, Shield, Sparkles, Zap, Smartphone, ExternalLink
} from "lucide-react";
import { format, differenceInDays, parseISO, isAfter } from "date-fns";
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
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState<"portal" | "carnet">("portal");
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

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

            if (member.tenant_id) {
                const { data: gs } = await supabase
                    .from("gym_settings")
                    .select("whatsapp_number, gym_name")
                    .eq("tenant_id", member.tenant_id)
                    .maybeSingle();
                if (gs?.whatsapp_number) gymWhatsApp = gs.whatsapp_number;
                if (gs?.gym_name) gymName = gs.gym_name;
            }

            return { ...member, planName, planColor, planPrice, planDays, gymWhatsApp, gymName };
        },
        enabled: !!memberId,
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
        const msg = `¡Hola! Soy ${data.full_name}. Mi membresía "${data.planName}" está por vencer y me gustaría renovarla. \u{1F389}`;
        const phone = data.gymWhatsApp?.replace(/\D/g, "") || "";
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
    // Fix: Using black pixels (dark=000000) for contrast on white background
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data.id)}&size=300&margin=2&dark=000000&light=ffffff`;
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
                                {data.photo_url ? (
                                    <img
                                        src={data.photo_url}
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
                                "flex-1 py-4 text-xs font-bold uppercase tracking-[.15em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-2",
                                activeTab === "portal" ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                            )}>
                            <Smartphone className="h-4 w-4" /> Mi Carnet
                        </button>
                        <button
                            onClick={() => setActiveTab("carnet")}
                            className={cn(
                                "flex-1 py-4 text-xs font-bold uppercase tracking-[.15em] rounded-2xl transition-all duration-300 flex items-center justify-center gap-2",
                                activeTab === "carnet" ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-white/40 hover:text-white/60"
                            )}>
                            <Zap className="h-4 w-4" /> QR Acceso
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === "portal" ? (
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
                                        <div className="shrink-0 p-1.5 bg-white rounded-2xl shadow-[0_0_25px_rgba(255,255,255,0.15)] ring-1 ring-black/5">
                                            <img src={qrUrl} alt="QR" className="h-16 w-16" crossOrigin="anonymous" />
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
                        ) : (
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
                                    <div className="relative bg-white p-8 rounded-[40px] shadow-2xl">
                                        <img src={qrUrl} alt="QR Big" className="h-52 w-52" crossOrigin="anonymous" />
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

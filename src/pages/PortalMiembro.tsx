import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import {
    CheckCircle2, XCircle, Dumbbell, Download, Loader2,
    AlertCircle, Calendar, Clock, RefreshCw, ArrowLeft, Shield
} from "lucide-react";
import { format, differenceInDays, parseISO, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    active: { label: "ACTIVO", icon: CheckCircle2, color: "#22c55e", bg: "#22c55e15" },
    expired: { label: "VENCIDO", icon: XCircle, color: "#FF6B6B", bg: "#FF6B6B15" },
    suspended: { label: "SUSPENDIDO", icon: XCircle, color: "#ef4444", bg: "#ef444415" },
    inactive: { label: "INACTIVO", icon: XCircle, color: "#6b7280", bg: "#6b728015" },
};

export default function PortalMiembro() {
    const { memberId } = useParams<{ memberId: string }>();
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [activeTab, setActiveTab] = useState<"portal" | "carnet">("portal");

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

            let planName = "Sin plan asignado";
            let planColor = "#7C3AED";
            let planPrice = 0;
            let planDays = 0;
            let gymWhatsApp = "";
            let gymName = "Kallpa";

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

            // Obtener WhatsApp y nombre del gym desde gym_settings del tenant
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
            // Carga html2canvas desde CDN dinámicamente para evitar dependencia de npm
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
            toast.success("Carnet descargado");
        } catch {
            toast.error("Toma una captura de pantalla del carnet.");
        } finally {
            setDownloading(false);
        }
    };

    const handleRenewal = () => {
        if (!data) return;
        const msg = `Hola! Soy ${data.full_name} (código: ${data.access_code}). Me gustaría renovar mi membresía "${data.planName}". ¿Cómo puedo hacerlo? 🏋️`;
        const phone = data.gymWhatsApp?.replace(/\D/g, "") || "";
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    // ─── Loading / Error ───────────────────────────────────────────────────
    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a14" }}>
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
    );

    if (isError || !data) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "#0a0a14" }}>
            <AlertCircle className="h-12 w-12 text-red-400" />
            <h1 className="text-xl font-bold text-white">Miembro no encontrado</h1>
            <Link to="/portal" className="text-violet-400 text-sm flex items-center gap-1 hover:underline">
                <ArrowLeft className="h-3 w-3" /> Volver a buscar
            </Link>
        </div>
    );

    // ─── Cálculos de vigencia ──────────────────────────────────────────────
    const today = new Date();
    const endDate = data.end_date ? parseISO(data.end_date) : null;
    const startDate = data.start_date ? parseISO(data.start_date) : parseISO(data.created_at);
    const totalDays = endDate && startDate ? differenceInDays(endDate, startDate) : data.planDays || 30;
    const daysLeft = endDate ? Math.max(0, differenceInDays(endDate, today)) : null;
    const daysUsed = startDate ? differenceInDays(today, startDate) : 0;
    const progress = totalDays > 0 ? Math.min(100, Math.round((daysUsed / totalDays) * 100)) : 0;
    const isExpired = endDate ? !isAfter(endDate, today) : false;

    let currentStatus = data.status ?? "active";
    if (isExpired && currentStatus === "active") {
        currentStatus = "expired";
    }
    const st = statusConfig[currentStatus] ?? statusConfig.active;

    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data.id)}&size=220&margin=1`;
    const memberId8 = data.id.toUpperCase().slice(-8);

    // ─── Render ────────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen pb-10 pt-6 px-4 flex flex-col items-center"
            style={{ background: "linear-gradient(160deg, #0a0a14 0%, #111120 60%, #0d1528 100%)" }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm flex flex-col gap-4"
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <Link to="/portal" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Cambiar miembro
                    </Link>
                    <div className="flex items-center gap-1.5 text-white/30 text-xs">
                        <Shield className="h-3 w-3" />
                        Código: <span className="font-mono font-bold text-violet-400">{data.access_code}</span>
                    </div>
                </div>

                {/* ── Nombre y estado ── */}
                <div className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm flex items-center gap-4">
                    <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                        style={{ background: data.planColor, opacity: 0.9 }}
                    >
                        {data.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-white truncate">{data.full_name}</h1>
                        <div
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}
                        >
                            <st.icon className="h-2.5 w-2.5" />
                            {st.label}
                        </div>
                    </div>
                </div>

                {/* ── Plan ── */}
                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="h-1" style={{ background: data.planColor }} />
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Plan Activo</p>
                                <p className="text-base font-bold text-white">{data.planName}</p>
                            </div>
                            {data.planPrice > 0 && (
                                <div className="text-right">
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Precio</p>
                                    <p className="text-base font-bold" style={{ color: data.planColor }}>
                                        S/ {data.planPrice.toFixed(2)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-white/5 p-3">
                                <div className="flex items-center gap-1.5 text-white/30 text-[10px] uppercase tracking-wider mb-1">
                                    <Calendar className="h-3 w-3" />
                                    Inicio
                                </div>
                                <p className="text-sm font-semibold text-white">
                                    {format(startDate, "dd MMM yyyy", { locale: es })}
                                </p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-3">
                                <div className="flex items-center gap-1.5 text-white/30 text-[10px] uppercase tracking-wider mb-1">
                                    <Clock className="h-3 w-3" />
                                    Vence
                                </div>
                                <p className={cn("text-sm font-semibold", isExpired ? "text-red-400" : "text-white")}>
                                    {endDate ? format(endDate, "dd MMM yyyy", { locale: es }) : "Sin fecha"}
                                </p>
                            </div>
                        </div>

                        {/* Barra de progreso */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-white/40">Progreso del período</span>
                                {daysLeft !== null && (
                                    <span className={cn("font-bold", isExpired ? "text-red-400" : daysLeft <= 5 ? "text-amber-400" : "text-white/70")}>
                                        {isExpired ? "VENCIDO" : `${daysLeft} días restantes`}
                                    </span>
                                )}
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full rounded-full"
                                    style={{
                                        background: isExpired
                                            ? "#ef4444"
                                            : progress > 80
                                                ? `linear-gradient(to right, ${data.planColor}, #f59e0b)`
                                                : data.planColor
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Tabs: Portal / Carnet ── */}
                <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                    <button
                        onClick={() => setActiveTab("portal")}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-xl transition-all",
                            activeTab === "portal"
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-white/40 hover:text-white/70"
                        )}
                    >
                        Mi Carnet
                    </button>
                    <button
                        onClick={() => setActiveTab("carnet")}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-xl transition-all",
                            activeTab === "carnet"
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-white/40 hover:text-white/70"
                        )}
                    >
                        Descargar QR
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === "portal" && (
                        <motion.div
                            key="portal"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex flex-col gap-3"
                        >
                            {/* Carnet visual */}
                            <div
                                ref={cardRef}
                                className="relative w-full rounded-3xl overflow-hidden shadow-2xl"
                                style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 60%, #16213e 100%)" }}
                            >
                                <div className="h-1.5 w-full" style={{ background: data.planColor }} />
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-10" style={{ background: data.planColor }} />
                                    <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full opacity-5" style={{ background: data.planColor }} />
                                </div>
                                <div className="relative flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                                        style={{ background: `${data.planColor}25`, border: `1.5px solid ${data.planColor}50` }}>
                                        <Dumbbell className="h-5 w-5" style={{ color: data.planColor }} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">PASE DE ACCESO</p>
                                        <p className="text-sm font-bold text-white">{data.gymName}</p>
                                    </div>
                                    <div className="ml-auto">
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                            style={{ background: `${st.color}20`, color: st.color, border: `1px solid ${st.color}40` }}>
                                            <st.icon className="h-2.5 w-2.5" />
                                            {st.label}
                                        </div>
                                    </div>
                                </div>
                                <div className="relative px-5 py-5 flex gap-4 items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Miembro</p>
                                        <h2 className="text-xl font-bold text-white leading-tight">{data.full_name}</h2>
                                        <div className="mt-3">
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Plan</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-2 w-2 rounded-full" style={{ background: data.planColor }} />
                                                <span className="text-sm font-semibold text-white">{data.planName}</span>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">ID</p>
                                            <p className="font-mono text-xs font-bold tracking-widest" style={{ color: data.planColor }}>#{memberId8}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-center gap-1">
                                        <div className="rounded-2xl overflow-hidden p-2 bg-white shadow-lg" style={{ width: 88, height: 88 }}>
                                            <img src={qrUrl} alt="QR" width={80} height={80} className="w-full h-full" crossOrigin="anonymous" />
                                        </div>
                                        <p className="text-[9px] text-white/30 text-center">Escanear en Terminal</p>
                                    </div>
                                </div>
                                <div className="relative px-5 pb-4">
                                    <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                                        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${data.planColor}40, transparent)` }} />
                                        <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider">Válido con membresía activa</p>
                                        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${data.planColor}40, transparent)` }} />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={downloadCard}
                                disabled={downloading}
                                className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                                {downloading
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Generando...</>
                                    : <><Download className="h-4 w-4" />Descargar Carnet</>
                                }
                            </button>
                        </motion.div>
                    )}

                    {activeTab === "carnet" && (
                        <motion.div
                            key="carnet"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex flex-col items-center gap-4"
                        >
                            <p className="text-white/50 text-sm text-center">Presenta este código QR en el Terminal de acceso del gimnasio</p>
                            <div className="rounded-3xl overflow-hidden p-5 bg-white shadow-2xl">
                                <img src={qrUrl} alt="QR de acceso" width={200} height={200} className="w-full h-full" crossOrigin="anonymous" />
                            </div>
                            <p className="font-mono text-xs text-white/30 tracking-widest">#{memberId8}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Botón Renovar ── */}
                <div className="mt-2 rounded-2xl border p-4 flex flex-col gap-3"
                    style={{
                        borderColor: isExpired ? "#ef444430" : "#ffffff15",
                        background: isExpired ? "#ef444408" : "transparent",
                    }}>
                    <div className="flex items-start gap-3">
                        <RefreshCw className={cn("h-5 w-5 mt-0.5 shrink-0", isExpired ? "text-red-400" : "text-white/30")} />
                        <div>
                            <p className="text-sm font-semibold text-white">
                                {isExpired ? "Tu membresía ha vencido" : "¿Quieres renovar?"}
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">
                                {isExpired
                                    ? "Contacta al gimnasio para reactivar tu acceso."
                                    : "Contacta al gimnasio para renovar antes de que venza."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleRenewal}
                        className={cn(
                            "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                            isExpired
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-[#25D366] text-white hover:bg-[#20b657]"
                        )}
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Contactar al Gimnasio
                    </button>
                </div>

                <p className="text-center text-[10px] text-white/15 mt-1">
                    Portal seguro — Solo tú tienes este enlace
                </p>
            </motion.div>
        </div>
    );
}

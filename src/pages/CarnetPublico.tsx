import { useParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Dumbbell, Download, Loader2, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    active: { label: "ACTIVO", icon: CheckCircle2, color: "#22c55e" },
    expired: { label: "VENCIDO", icon: XCircle, color: "#FF6B6B" },
    suspended: { label: "SUSPENDIDO", icon: XCircle, color: "#ef4444" },
    inactive: { label: "INACTIVO", icon: XCircle, color: "#6b7280" },
};

export default function CarnetPublico() {
    const { memberId } = useParams<{ memberId: string }>();
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["public_carnet", memberId],
        queryFn: async () => {
            if (!memberId) throw new Error("Sin ID");

            // Fetch miembro (anon)
            const { data: member, error: mErr } = await supabase
                .from("members")
                .select("id, full_name, status, plan, phone, end_date")
                .eq("id", memberId)
                .single();
            if (mErr || !member) throw new Error("Miembro no encontrado");

            // Fetch plan (anon)
            let planName = "—";
            let planColor = "#7C3AED";
            if (member.plan) {
                const { data: plan } = await supabase
                    .from("membership_plans")
                    .select("name, color")
                    .eq("id", member.plan)
                    .maybeSingle();
                if (plan) { planName = plan.name; planColor = plan.color; }
            }

            return { ...member, planName, planColor };
        },
        enabled: !!memberId,
        staleTime: 1000 * 60 * 5,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
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
            link.download = `carnet-${data?.full_name?.replace(/\s+/g, "-").toLowerCase() ?? "miembro"}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("Carnet descargado");
        } catch {
            toast.error("Error al descargar. Toma una captura de pantalla.");
        } finally {
            setDownloading(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
    );

    if (isError || !data) return (
        <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center gap-4 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <h1 className="text-xl font-bold text-white">Carnet no encontrado</h1>
            <p className="text-white/50 text-sm">El enlace puede ser inválido o haber expirado.</p>
        </div>
    );

    let currentStatus = data.status ?? "active";
    if (data.end_date) {
        const end = new Date(data.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (end < today && currentStatus === 'active') {
            currentStatus = 'expired';
        }
    }
    const st = statusConfig[currentStatus] ?? statusConfig.active;
    // QR local — sin dependencia de quickchart.io ni servicios externos
    const memberId8 = data.id.toUpperCase().slice(-8);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ background: "linear-gradient(135deg, #0a0a14 0%, #111120 60%, #0d1528 100%)" }}>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm flex flex-col gap-4"
            >
                {/* CARNET */}
                <div
                    ref={cardRef}
                    className="relative w-full rounded-3xl overflow-hidden shadow-2xl"
                    style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 60%, #16213e 100%)" }}
                >
                    {/* Barra color plan */}
                    <div className="h-1.5 w-full" style={{ background: data.planColor }} />

                    {/* Fondos decorativos */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-10"
                            style={{ background: data.planColor }} />
                        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full opacity-5"
                            style={{ background: data.planColor }} />
                    </div>

                    {/* Header */}
                    <div className="relative flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${data.planColor}25`, border: `1.5px solid ${data.planColor}50` }}>
                            <Dumbbell className="h-5 w-5" style={{ color: data.planColor }} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">PASE DE ACCESO</p>
                            <p className="text-sm font-bold text-white">Kallpa</p>
                        </div>
                        <div className="ml-auto">
                            <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: `${st.color}20`, color: st.color, border: `1px solid ${st.color}40` }}
                            >
                                <st.icon className="h-2.5 w-2.5" />
                                {st.label}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative px-5 py-5 flex gap-4 items-start">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Miembro</p>
                            <h2 className="text-2xl font-bold text-white leading-tight">{data.full_name}</h2>

                            <div className="mt-4">
                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Plan</p>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full" style={{ background: data.planColor }} />
                                    <span className="text-sm font-semibold text-white">{data.planName}</span>
                                </div>
                            </div>

                            {data.end_date && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Válido hasta</p>
                                    <p className={cn("text-sm font-semibold", currentStatus === 'expired' ? "text-red-400" : "text-white")}>
                                        {format(new Date(data.end_date), "d 'de' MMMM, yyyy", { locale: es })}
                                    </p>
                                </div>
                            )}

                            <div className="mt-4">
                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">ID de Miembro</p>
                                <p className="font-mono text-sm font-bold tracking-widest" style={{ color: data.planColor }}>
                                    #{memberId8}
                                </p>
                            </div>
                        </div>

                        {/* QR */}
                        <div className="shrink-0 flex flex-col items-center gap-1">
                            <div className="rounded-2xl overflow-hidden p-2 bg-white shadow-lg flex items-center justify-center" style={{ width: 96, height: 96 }}>
                                <QRCode value={data.id} size={80} level="M" />
                            </div>
                            <p className="text-[9px] text-white/30 text-center font-medium">Escanear en Terminal</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="relative px-5 pb-5">
                        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                            <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${data.planColor}40, transparent)` }} />
                            <p className="text-[9px] text-white/20 font-mono uppercase tracking-wider">Válido con membresía activa</p>
                            <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${data.planColor}40, transparent)` }} />
                        </div>
                    </div>
                </div>

                {/* Botón descarga */}
                <button
                    onClick={downloadCard}
                    disabled={downloading}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                        background: data.planColor,
                        color: "#fff",
                        opacity: downloading ? 0.7 : 1,
                    }}
                >
                    {downloading
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Generando...</>
                        : <><Download className="h-4 w-4" />Descargar mi Carnet</>
                    }
                </button>

                <p className="text-center text-xs text-white/20">
                    Presenta este carnet en recepción o usa el QR en el Terminal de acceso.
                </p>
            </motion.div>
        </div>
    );
}

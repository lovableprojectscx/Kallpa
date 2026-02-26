import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    Search, CheckCircle2, XCircle, Clock, Users,
    LogOut, Dumbbell, ScanLine, AlertTriangle, Bell, Camera, UserMinus
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type ScanStatus = "idle" | "processing" | "approved" | "denied";

export default function Recepcion() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ScanStatus>("idle");
    const [scannedMember, setScannedMember] = useState<{ name: string; plan: string; info: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // tenant efectivo: sessionStorage (cuando admin entra como staff de otro gym) o el propio
    const effectiveTenantId = sessionStorage.getItem("staff_tenant_id") || user?.tenantId;

    // ── Data ──────────────────────────────────────────────────
    const { data: todayCheckins = [] } = useQuery({
        queryKey: ["reception_today", effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return [];
            const today = new Date().toISOString().split("T")[0];
            const { data } = await supabase
                .from("attendance")
                .select("id, check_in_time, member_id, members(full_name, plan, status)")
                .eq("tenant_id", effectiveTenantId)
                .gte("check_in_time", `${today}T00:00:00`)
                .order("check_in_time", { ascending: false });
            return data || [];
        },
        refetchInterval: 15000,
        enabled: !!effectiveTenantId,
    });

    const { data: alerts = [] } = useQuery({
        queryKey: ["reception_alerts", effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return [];
            const { data } = await supabase
                .from("members")
                .select("id, full_name, end_date, status")
                .eq("tenant_id", effectiveTenantId)
                .in("status", ["active", "expired"])
                .order("end_date", { ascending: true })
                .limit(5);
            return (data || []).filter((m: any) => {
                if (!m.end_date) return false;
                const days = Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000);
                return days <= 5;
            });
        },
        enabled: !!effectiveTenantId,
    });

    const { data: memberSearch = [] } = useQuery({
        queryKey: ["member_search", effectiveTenantId, searchTerm],
        queryFn: async () => {
            if (!effectiveTenantId || searchTerm.length < 2) return [];
            const { data } = await supabase
                .from("members")
                .select("id, full_name, status, plan, end_date")
                .eq("tenant_id", effectiveTenantId)
                .ilike("full_name", `%${searchTerm}%`)
                .limit(6);
            return data || [];
        },
        enabled: searchTerm.length >= 2,
    });

    const { data: allPlans = [] } = useQuery({
        queryKey: ["plans_recepcion", effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return [];
            const { data } = await supabase.from("membership_plans").select("id, name, color").eq("tenant_id", effectiveTenantId);
            return data || [];
        },
        enabled: !!effectiveTenantId,
    });

    const getPlanName = (planId: string) => (allPlans as any[]).find(p => p.id === planId)?.name || "Sin plan";
    const getPlanColor = (planId: string) => (allPlans as any[]).find(p => p.id === planId)?.color || "#7C3AED";

    // ── Check-in mutation ─────────────────────────────────────
    const processScan = useMutation({
        mutationFn: async (memberId: string) => {
            if (!effectiveTenantId) throw new Error("Sin tenant");
            setStatus("processing");
            const { data: member, error } = await supabase
                .from("members")
                .select("id, full_name, status, plan, end_date")
                .eq("id", memberId)
                .eq("tenant_id", effectiveTenantId)
                .single();

            if (error || !member) throw new Error("Miembro no encontrado");
            if (member.status !== "active") {
                setStatus("denied");
                setScannedMember({ name: member.full_name, plan: getPlanName(member.plan), info: "Membresía no activa" });
                return;
            }

            await supabase.from("attendance").insert({
                member_id: memberId, tenant_id: effectiveTenantId,
                check_in_time: new Date().toISOString(),
            });

            const days = member.end_date
                ? Math.ceil((new Date(member.end_date).getTime() - Date.now()) / 86400000)
                : null;

            setStatus("approved");
            setScannedMember({
                name: member.full_name,
                plan: getPlanName(member.plan),
                info: days !== null ? `${days} días restantes` : "Activo",
            });
            queryClient.invalidateQueries({ queryKey: ["reception_today"] });
        },
        onError: () => { setStatus("denied"); setScannedMember({ name: "Desconocido", plan: "", info: "No registrado" }); },
        onSettled: () => { setTimeout(() => { setStatus("idle"); setScannedMember(null); }, 3500); },
    });

    const handleCameraScan = (data: any) => {
        if (data?.[0]?.rawValue && status === "idle") processScan.mutate(data[0].rawValue);
    };

    const handleManualCheckin = (member: any) => {
        setShowSearch(false);
        setSearchTerm("");
        processScan.mutate(member.id);
    };

    const handleLogout = async () => {
        sessionStorage.removeItem("staff_tenant_id");
        await logout();
        navigate("/recepcion/login");
    };

    const handleLeaveGym = async () => {
        if (!confirm("¿Deseas retirarte de este gimnasio? Perderás el acceso a la recepción.")) return;
        const tid = sessionStorage.getItem("staff_tenant_id") || user?.tenantId;
        if (tid && user?.id) {
            await supabase.rpc('remove_staff_member', { p_user_id: user.id, p_tenant_id: tid });
        }
        sessionStorage.removeItem("staff_tenant_id");
        await logout();
        navigate("/recepcion/login");
    };

    // ── UI ────────────────────────────────────────────────────
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

    return (
        <div className="min-h-screen bg-[#0a0a14] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ── TOP BAR ── */}
            <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0f0f1c]/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                        <Dumbbell className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-xs text-white/30">{greeting},</p>
                        <p className="text-sm font-semibold text-white">{user?.name || "Recepción"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Botón para que el staff se retire del gimnasio */}
                    <button onClick={handleLeaveGym}
                        title="Retirarme de este gimnasio"
                        className="hidden sm:flex h-8 px-3 rounded-lg bg-white/5 border border-white/10 items-center gap-1.5 text-[11px] text-white/30 hover:text-amber-400 hover:border-amber-400/30 transition-colors">
                        <UserMinus className="h-3.5 w-3.5" />
                        Salir del gimnasio
                    </button>
                    <button onClick={handleLogout}
                        title="Cerrar sesión"
                        className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-400/30 transition-colors">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* ── MAIN GRID ── */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-0 overflow-hidden">

                {/* ── LEFT: ALERTAS ── */}
                <aside className="border-r border-white/5 p-4 flex flex-col gap-3 overflow-y-auto hidden lg:flex">
                    <div className="flex items-center gap-2 mb-1">
                        <Bell className="h-4 w-4 text-amber-400" />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Alertas</h2>
                    </div>

                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <CheckCircle2 className="h-8 w-8 text-green-500/40" />
                            <p className="text-xs text-white/20">Sin membresías próximas a vencer</p>
                        </div>
                    ) : alerts.map((m: any) => {
                        const days = Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000);
                        const isExpired = days <= 0;
                        return (
                            <div key={m.id}
                                className={cn("rounded-xl p-3 border flex items-start gap-2.5",
                                    isExpired ? "bg-red-500/8 border-red-500/20" : "bg-amber-500/8 border-amber-500/20")}>
                                <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", isExpired ? "text-red-400" : "text-amber-400")} />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{m.full_name}</p>
                                    <p className={cn("text-xs mt-0.5", isExpired ? "text-red-400" : "text-amber-400")}>
                                        {isExpired ? "Vencido" : `Vence en ${days} día${days !== 1 ? "s" : ""}`}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </aside>

                {/* ── CENTER: SCANNER ── */}
                <main className="flex flex-col items-center justify-center gap-6 p-6 relative">

                    {/* Búsqueda manual */}
                    <div className="w-full max-w-sm relative">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-violet-500/50 transition-colors">
                            <Search className="h-4 w-4 text-white/30 shrink-0" />
                            <input
                                ref={searchRef}
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setShowSearch(true); }}
                                onFocus={() => setShowSearch(true)}
                                placeholder="Buscar miembro por nombre..."
                                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                            />
                        </div>

                        <AnimatePresence>
                            {showSearch && memberSearch.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute top-full mt-2 w-full bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-20"
                                >
                                    {(memberSearch as any[]).map((m) => {
                                        const days = m.end_date ? Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000) : null;
                                        return (
                                            <button key={m.id} onClick={() => handleManualCheckin(m)}
                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left">
                                                <div className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white"
                                                    style={{ background: getPlanColor(m.plan) }}>
                                                    {m.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-white truncate">{m.full_name}</p>
                                                    <p className="text-xs text-white/40">{getPlanName(m.plan)}</p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    {m.status === "active"
                                                        ? <span className="text-xs text-green-400 font-medium">Activo</span>
                                                        : <span className="text-xs text-red-400 font-medium">Vencido</span>}
                                                    {days !== null && (
                                                        <p className="text-[10px] text-white/30">{days > 0 ? `${days}d` : "venció"}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {showSearch && <div className="fixed inset-0 z-10" onClick={() => setShowSearch(false)} />}

                    {/* Scanner Principal */}
                    <div className={cn(
                        "relative w-full max-w-sm h-[360px] rounded-[2.5rem] border-2 overflow-hidden transition-all duration-500 shadow-2xl",
                        status === "idle" ? "border-white/10 bg-black" : "",
                        status === "processing" ? "border-violet-500/60 shadow-[0_0_40px_rgba(139,92,246,0.3)]" : "",
                        status === "approved" ? "border-green-500 bg-green-500/5 shadow-[0_0_60px_rgba(34,197,94,0.4)]" : "",
                        status === "denied" ? "border-red-500 bg-red-500/5 shadow-[0_0_60px_rgba(239,68,68,0.4)]" : "",
                    )}>
                        <AnimatePresence mode="wait">
                            {status === "idle" && (
                                <motion.div key="cam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0">
                                    <Scanner
                                        onScan={handleCameraScan}
                                        components={{ finder: false }}
                                        styles={{ container: { width: "100%", height: "100%" } }}
                                    />
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="relative w-48 h-48">
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-violet-400 rounded-tl-lg" />
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-violet-400 rounded-tr-lg" />
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-violet-400 rounded-bl-lg" />
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-violet-400 rounded-br-lg" />
                                            <motion.div
                                                className="absolute left-0 right-0 h-0.5 bg-violet-400/60"
                                                animate={{ top: ["10%", "90%", "10%"] }}
                                                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5">
                                        <Camera className="h-3 w-3 text-white/40" />
                                        <span className="text-[10px] text-white/40">Apunta el QR al lector</span>
                                    </div>
                                </motion.div>
                            )}

                            {status === "processing" && (
                                <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="h-16 w-16 rounded-full border-2 border-violet-500/30 border-t-violet-500"
                                    />
                                    <p className="text-sm text-white/50 font-medium">Verificando...</p>
                                </motion.div>
                            )}

                            {status === "approved" && scannedMember && (
                                <motion.div key="ok" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[#0a0a14]">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                        className="h-20 w-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-green-400" />
                                    </motion.div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-white">{scannedMember.name}</p>
                                        <p className="text-sm text-green-400 mt-1">{scannedMember.plan}</p>
                                        <p className="text-xs text-white/30 mt-2">{scannedMember.info}</p>
                                    </div>
                                    <div className="px-6 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                                        <p className="text-sm font-bold text-green-400">✓ ACCESO PERMITIDO</p>
                                    </div>
                                </motion.div>
                            )}

                            {status === "denied" && scannedMember && (
                                <motion.div key="no" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[#0a0a14]">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                        className="h-20 w-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                                        <XCircle className="h-10 w-10 text-red-400" />
                                    </motion.div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-white">{scannedMember.name}</p>
                                        <p className="text-xs text-white/30 mt-2">{scannedMember.info}</p>
                                    </div>
                                    <div className="px-6 py-2 rounded-full bg-red-500/20 border border-red-500/30">
                                        <p className="text-sm font-bold text-red-400">✕ ACCESO DENEGADO</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <p className="text-xs text-white/20 text-center">
                        Escanea el carnet QR del miembro — o usa el buscador para check-in manual
                    </p>
                </main>

                {/* ── RIGHT: HOY ── */}
                <aside className="border-l border-white/5 p-4 flex flex-col gap-3 overflow-y-auto hidden lg:flex">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-violet-400" />
                            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">En Gimnasio Hoy</h2>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">
                            {todayCheckins.length}
                        </span>
                    </div>

                    {todayCheckins.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <ScanLine className="h-8 w-8 text-white/10" />
                            <p className="text-xs text-white/20">Nadie ha ingresado hoy todavía</p>
                        </div>
                    ) : (todayCheckins as any[]).map((c) => (
                        <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 rounded-xl p-2.5 bg-white/3 border border-white/5">
                            <div className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white bg-violet-600/30">
                                {(c.members?.full_name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white truncate">{c.members?.full_name || "Miembro"}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="h-2.5 w-2.5 text-white/20" />
                                    <p className="text-[10px] text-white/30">
                                        {formatDistanceToNow(new Date(c.check_in_time), { locale: es, addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </aside>
            </div>

            {/* ── MOBILE ── */}
            <div className="lg:hidden border-t border-white/5">
                <div className="p-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Users className="h-3.5 w-3.5 text-violet-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Presentes</span>
                            <span className="ml-auto text-xs font-bold text-violet-300">{todayCheckins.length}</span>
                        </div>
                        {(todayCheckins as any[]).slice(0, 3).map((c) => (
                            <p key={c.id} className="text-xs text-white/60 truncate">{c.members?.full_name}</p>
                        ))}
                        {todayCheckins.length === 0 && <p className="text-xs text-white/20">Ninguno aún</p>}
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Alertas</span>
                            <span className="ml-auto text-xs font-bold text-amber-300">{alerts.length}</span>
                        </div>
                        {(alerts as any[]).slice(0, 3).map((m: any) => {
                            const days = Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000);
                            return <p key={m.id} className="text-xs text-white/60 truncate">{m.full_name} · {days <= 0 ? "vencido" : `${days}d`}</p>;
                        })}
                        {alerts.length === 0 && <p className="text-xs text-white/20">Sin alertas</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

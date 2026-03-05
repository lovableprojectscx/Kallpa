import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ScanLine, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function AceptarInvitacion() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        // Supabase redirige con #access_token en la URL al aceptar invitación
        const hash = window.location.hash;
        if (!hash.includes("access_token")) {
            toast.error("Link de invitación inválido o expirado.");
        }
    }, []);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres."); return; }
        if (password !== confirm) { toast.error("Las contraseñas no coinciden."); return; }

        setLoading(true);
        try {
            // 1. Establecer la contraseña del usuario
            const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            const userId = updateData.user?.id;
            const meta = updateData.user?.user_metadata;

            if (!userId || !meta?.tenant_id) {
                throw new Error("Invitación inválida: faltan datos del gimnasio. Contacta a tu administrador.");
            }

            // Actualizar profile: confirmar que está activo
            await supabase.from("profiles").upsert({
                id: userId,
                full_name: meta.full_name || "",
                email: updateData.user?.email || "",
                role: "staff",
                tenant_id: meta.tenant_id,
                status: "active",
            }, { onConflict: "id" });

            sessionStorage.setItem("staff_tenant_id", meta.tenant_id);

            setDone(true);
            setTimeout(() => navigate("/recepcion", { replace: true }), 2000);
        } catch (err: any) {
            toast.error(err.message || "Error al establecer la contraseña.");
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                    <div className="h-20 w-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-10 w-10 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-white">¡Bienvenido al equipo!</p>
                    <p className="text-sm text-white/40 mt-2">Redirigiendo a recepción...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ background: "linear-gradient(135deg, #0a0a14 0%, #0f0f1c 60%, #111128 100%)" }}
        >
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm"
            >
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                        <ScanLine className="h-7 w-7 text-violet-400" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white">Acepta tu invitación</h1>
                        <p className="text-sm text-white/40 mt-1">Crea tu contraseña para acceder al terminal</p>
                    </div>
                </div>

                <form onSubmit={handleSetPassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                            Nueva Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                            Confirmar Contraseña
                        </label>
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Repite la contraseña"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : "Crear mi acceso"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

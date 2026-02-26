import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Dumbbell, Eye, EyeOff, Loader2, ScanLine } from "lucide-react";

export default function LoginRecepcion() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (authError || !authData.user) {
                toast.error("Email o contraseña incorrectos.");
                setLoading(false);
                return;
            }

            // Verificar rol en profiles
            const { data: profile } = await supabase
                .from("profiles")
                .select("role, tenant_id, status")
                .eq("id", authData.user.id)
                .single();

            if (profile?.role === "admin") {
                // Es dueño de empresa — no puede entrar por recepción
                await supabase.auth.signOut();
                toast.error("Esta cuenta es de administrador. Usa el acceso de empresa.", { duration: 5000 });
                setLoading(false);
                return;
            }

            if (profile?.role === "staff" && profile?.tenant_id) {
                sessionStorage.setItem("staff_tenant_id", profile.tenant_id);
                navigate("/recepcion", { replace: true });
                return;
            }

            // No tiene perfil de staff válido
            await supabase.auth.signOut();
            toast.error("Esta cuenta no tiene acceso de recepcionista.", { duration: 5000 });
        } catch {
            toast.error("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

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
                {/* Logo */}
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                        <ScanLine className="h-7 w-7 text-violet-400" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white">Acceso Recepción</h1>
                        <p className="text-sm text-white/40 mt-1">Kallpa — Terminal de personal</p>
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                            >
                                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</> : "Ingresar al Terminal"}
                    </button>
                </form>

                {/* Separador */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs text-white/20">¿Eres administrador?</span>
                    <div className="flex-1 h-px bg-white/5" />
                </div>

                <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                >
                    <Dumbbell className="h-4 w-4" />
                    Acceso Administrador
                </Link>
            </motion.div>
        </div>
    );
}

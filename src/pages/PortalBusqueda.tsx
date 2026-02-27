import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Search, Loader2, AlertCircle, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortalBusqueda() {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = code.trim().toUpperCase();
        if (!clean) return;

        setLoading(true);
        setError("");

        try {
            const { data, error: err } = await supabase
                .from("members")
                .select("id")
                .eq("access_code", clean)
                .maybeSingle();

            if (err || !data) {
                setError("No encontramos ningún miembro con ese código.");
                return;
            }
            navigate(`/portal/${data.id}`);
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-primary/30"
            style={{ background: "#050508" }}
        >
            {/* --- Background Decorative Elements --- */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                {/* --- Main Card --- */}
                <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl space-y-10">

                    {/* Header/Logo */}
                    <div className="flex flex-col items-center gap-6">
                        <motion.div
                            initial={{ y: -10 }}
                            animate={{ y: 0 }}
                            className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-violet-600 p-[1px] shadow-2xl shadow-primary/20"
                        >
                            <div className="h-full w-full rounded-[23px] bg-[#0d0d15] flex items-center justify-center">
                                <Dumbbell className="h-10 w-10 text-white" />
                            </div>
                        </motion.div>

                        <div className="text-center space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight text-white">Portal KALLPA</h1>
                            <p className="text-white/40 text-sm font-medium">Ingresa tu código de acceso digital</p>
                        </div>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSearch} className="space-y-6">
                        <div className="relative group">
                            <motion.div
                                animate={isFocused ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                                className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-violet-600/50 rounded-3xl blur-md pointer-events-none"
                            />
                            <div className="relative">
                                <input
                                    type="text"
                                    value={code}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                                    placeholder="CÓDIGO"
                                    maxLength={8}
                                    className={cn(
                                        "w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm text-white text-center text-3xl font-mono tracking-[0.3em] py-6 px-4",
                                        "placeholder:text-white/10 placeholder:tracking-normal placeholder:font-sans focus:outline-none transition-all duration-300",
                                        isFocused ? "border-primary/40 bg-white/10" : "hover:bg-white/[0.07]"
                                    )}
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                                    <Zap className="h-6 w-6" />
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex items-center gap-3 text-red-400 text-sm bg-red-400/10 rounded-2xl p-4 border border-red-400/20"
                                >
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <span className="font-medium">{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={loading || code.trim().length < 4}
                            className={cn(
                                "group relative w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-300 overflow-hidden",
                                "bg-white text-black hover:bg-white/90 active:scale-[0.98] disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed shadow-xl shadow-white/5"
                            )}
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Search className="h-5 w-5" />
                                    <span>ACCEDER AL PORTAL</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                            <ShieldCheck className="h-4 w-4" />
                            Acceso Seguro y Encriptado
                        </div>

                        <p className="text-[11px] text-white/30 text-center leading-relaxed font-medium max-w-[280px]">
                            Tu código de acceso fue enviado por WhatsApp al momento de tu registro en el gimnasio.
                        </p>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 flex flex-col items-center gap-1.5 opacity-20 grayscale selection:none"
                >
                    <Dumbbell className="h-4 w-4 text-white" />
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-white">Powered by KALLPA PRO</span>
                </motion.div>
            </motion.div>
        </div>
    );
}


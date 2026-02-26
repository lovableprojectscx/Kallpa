import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Dumbbell, Search, Loader2, AlertCircle } from "lucide-react";

export default function PortalBusqueda() {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
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
                setError("Código no encontrado. Verifica e intenta de nuevo.");
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
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ background: "linear-gradient(135deg, #0a0a14 0%, #111120 60%, #0d1528 100%)" }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm flex flex-col items-center gap-8"
            >
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                        <Dumbbell className="h-8 w-8 text-violet-400" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white">Portal del Miembro</h1>
                        <p className="text-sm text-white/40 mt-1">Ingresa tu código de acceso</p>
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSearch} className="w-full flex flex-col gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
                            placeholder="Ej. A3F9K2"
                            maxLength={8}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm text-white text-center text-2xl font-mono tracking-widest py-4 px-6 placeholder:text-white/20 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all"
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3 border border-red-400/20"
                        >
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || code.trim().length < 4}
                        className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading
                            ? <><Loader2 className="h-5 w-5 animate-spin" />Buscando...</>
                            : <><Search className="h-5 w-5" />Ver mi Portal</>
                        }
                    </button>
                </form>

                <p className="text-xs text-white/20 text-center leading-relaxed">
                    Tu código de acceso fue enviado por WhatsApp<br />cuando te registraste en el gimnasio.
                </p>
            </motion.div>
        </div>
    );
}

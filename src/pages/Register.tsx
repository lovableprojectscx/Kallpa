import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, User, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

/**
 * Página de registro de nuevos propietarios de gimnasio.
 * Flujo:
 * 1. Registra al usuario en Supabase Auth con email/contraseña.
 * 2. Si se proporcionó un código de referido, lo vincula en la tabla profiles.
 * 3. Si signUp devuelve sesión directamente, navega a /onboarding.
 *    Si no (config de confirmación de email), hace signIn manual silencioso.
 * También permite registro con Google OAuth.
 */
const Register = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [referralCode, setReferralCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { loginWithGoogle, isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    /**
     * Redirige si el usuario ya tiene sesión activa.
     * Corre cuando isLoading pasa a false (auth inicializado).
     */
    useEffect(() => {
        if (!isLoading && isAuthenticated && user) {
            if (user.role === 'superadmin') navigate('/admin', { replace: true });
            else if (user.role === 'staff') navigate('/recepcion', { replace: true });
            else navigate('/dashboard', { replace: true });
        }
    }, [isLoading, isAuthenticated, user, navigate]);

    /** Pre-rellena el campo de referido si la URL contiene ?ref=CODIGO. */
    useEffect(() => {
        const ref = searchParams.get("ref");
        if (ref) {
            setReferralCode(ref.toUpperCase());
        }
    }, [searchParams]);

    /**
     * Maneja el submit del formulario de registro.
     * Valida campos mínimos, registra en Auth, vincula afiliado si hay código,
     * e inicia sesión automáticamente navegando a /onboarding.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email || !password) {
            toast.error("Por favor completa todos los campos requeridos");
            return;
        }

        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Registrar en Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name.trim(), // Se guarda en user_metadata y AuthContext lo lee
                    }
                }
            });

            if (error) {
                toast.error("Error al registrarse: " + error.message);
                return;
            }

            if (data.user) {
                // 2. Vincular código de referido si se proporcionó
                if (referralCode.trim()) {
                    try {
                        const { data: aff } = await supabase
                            .from('affiliates')
                            .select('id')
                            .eq('code', referralCode.trim().toUpperCase())
                            .single();

                        if (aff) {
                            await supabase
                                .from('profiles')
                                .update({ referred_by: aff.id })
                                .eq('id', data.user.id);
                        }
                    } catch (err) {
                        // No crítico: el registro sigue siendo válido sin afiliado
                        console.error("Error linking affiliate:", err);
                    }
                }

                // 3. Si signUp devolvió sesión, navegar directamente a onboarding
                if (data.session) {
                    toast.success("¡Bienvenido a KALLPA! Tu cuenta ha sido creada.");
                    navigate("/onboarding", { replace: true });
                } else {
                    // Supabase requiere confirmación de email: intentar login silencioso
                    const { error: loginError } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (loginError) {
                        toast.error("Cuenta creada, pero por favor inicia sesión manualmente.");
                        navigate("/login");
                    } else {
                        toast.success("¡Bienvenido a KALLPA!");
                        navigate("/onboarding", { replace: true });
                    }
                }
            }
        } catch (error) {
            toast.error("Error inesperado al crear tu cuenta");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-coral/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[400px] space-y-4 sm:space-y-8"
            >
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4 sm:mb-6">
                        <Link to="/login">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="h-12 w-12 sm:h-16 sm:w-16 overflow-hidden flex items-center justify-center p-1 mx-auto"
                            >
                                <img src="/logo.png" alt="Kallpa Logo" className="h-full w-full object-contain drop-shadow-sm glow-volt" />
                            </motion.div>
                        </Link>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-foreground">Crear Cuenta</h1>
                    <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-[0.2em] font-medium">Digitaliza tu negocio</p>
                </div>

                <div className="rounded-2xl border bg-card/40 text-card-foreground shadow-2xl backdrop-blur-xl p-5 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Ej. Carlos Mendoza"
                                    className="pl-10 bg-secondary/30 border-border/50 focus:ring-primary/20 h-11"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico Oficial</Label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@mugym.com"
                                    className="pl-10 bg-secondary/30 border-border/50 focus:ring-primary/20 h-11"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña Segura</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 6 caracteres"
                                    className="pl-10 pr-10 bg-secondary/30 border-border/50 focus:ring-primary/20 h-11"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="referralCode">Código de Invitación (Opcional)</Label>
                            <div className="relative group">
                                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="referralCode"
                                    type="text"
                                    placeholder="Ej. GYM-A1B2C3"
                                    className="pl-10 uppercase bg-secondary/30 border-border/50 focus:ring-primary/20 h-11"
                                    value={referralCode}
                                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className={cn(
                                "w-full h-11 text-sm font-semibold transition-all duration-300 gap-2",
                                isSubmitting ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] glow-volt"
                            )}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generando entorno...
                                </>
                            ) : (
                                <>
                                    Registrarme Gratis
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>

                        <div className="relative mt-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">O continuar con</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => loginWithGoogle()}
                            disabled={isSubmitting}
                            className="w-full h-11 bg-card hover:bg-secondary border-border/50 text-foreground transition-all duration-300"
                        >
                            <svg className="h-5 w-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Registrarme con Google
                        </Button>

                        <div className="text-center pt-2">
                            <span className="text-xs text-muted-foreground">¿Ya tienes tu gimnasio en KALLPA? </span>
                            <Link to="/login" className="text-xs text-primary font-bold hover:underline">
                                Iniciar Sesión
                            </Link>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;

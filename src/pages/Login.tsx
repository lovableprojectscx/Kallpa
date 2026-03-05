import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowRight, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";


const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, loginWithGoogle, isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const fromPath = location.state?.from?.pathname;
    const from = (!fromPath || fromPath === "/") ? "/dashboard" : fromPath;

    // Si ya hay sesión activa, redirigir al destino correspondiente
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            if (user?.role === 'superadmin') navigate('/admin', { replace: true });
            else if (user?.role === 'staff') navigate('/recepcion', { replace: true });
            else navigate(from, { replace: true });
        }
    }, [isLoading, isAuthenticated, user?.role]);

    const handleSubmitOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Por favor completa todos los campos");
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await login(email, password);
            if (success) {
                // Verificar que sea admin — bloquear si es staff
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("role")
                        .eq("id", authUser.id)
                        .single();

                    if (profile?.role === "staff") {
                        await supabase.auth.signOut();
                        toast.error("Esta cuenta es de recepcionista. Usa el acceso de recepción.", { duration: 6000 });
                        navigate("/recepcion/login");
                        return;
                    }
                }
                toast.success("¡Bienvenido!");
                navigate(from, { replace: true });
            } else {
                toast.error("Credenciales incorrectas. Verifica tu email y contraseña.");
            }
        } catch (error) {
            console.error("Login catch error:", error);
            toast.error("Error al iniciar sesión. Intenta de nuevo.");
        } finally {
            setIsSubmitting(false);
        }

    };

    return (
        <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Bio-Luminescente decorativos */}
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
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="h-12 w-12 sm:h-16 sm:w-16 overflow-hidden flex items-center justify-center p-1"
                        >
                            <img src="/logo.png" alt="Kallpa Logo" className="h-full w-full object-contain drop-shadow-sm glow-volt" />
                        </motion.div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-foreground">KALLPA</h1>
                    <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-[0.2em] font-medium">Pro Suite Admin</p>
                </div>

                <Tabs defaultValue="owner" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-secondary/50 p-1 rounded-xl">
                        <TabsTrigger value="owner" className="rounded-lg py-2 sm:py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs sm:text-sm font-semibold tracking-wide">
                            <UserCog className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                            Propietario
                        </TabsTrigger>
                        <TabsTrigger value="staff" className="rounded-lg py-2 sm:py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs sm:text-sm font-semibold tracking-wide">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                            Recepción
                        </TabsTrigger>
                    </TabsList>

                    <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl p-5 sm:p-8">
                        <TabsContent value="owner" className="mt-0 outline-none space-y-4 sm:space-y-6">
                            <form onSubmit={handleSubmitOwner} className="space-y-4 sm:space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email del Propietario</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="admin@tuempresa.com"
                                            className="pl-10 bg-secondary/30 border-border/50 focus:ring-primary/20 h-11"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password-owner">Contraseña</Label>
                                        <Link to="/forgot-password" className="text-[11px] text-primary hover:underline font-medium">¿Olvidaste tu contraseña?</Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="password-owner"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
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

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-full h-11 text-sm font-semibold transition-all duration-300 gap-2",
                                        isSubmitting ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] glow-volt"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" />Iniciando...</>
                                    ) : (
                                        <>Entrar como Propietario <ArrowRight className="h-4 w-4" /></>
                                    )}
                                </Button>
                            </form>

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
                                Ingresar con Google
                            </Button>

                            <div className="mt-6 text-center text-sm pt-2">
                                <span className="text-muted-foreground mr-1">¿Nueva empresa?</span>
                                <Link to="/register" className="text-primary font-semibold hover:underline">
                                    Crear cuenta gratis
                                </Link>
                            </div>
                        </TabsContent>

                        <TabsContent value="staff" className="mt-0 outline-none space-y-4 sm:space-y-6">
                            <div className="flex flex-col items-center justify-center gap-6 py-4 text-center">
                                <Users className="h-12 w-12 text-primary/40" />
                                <div>
                                    <p className="text-sm font-medium text-foreground">Acceso para Recepcionistas</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        El personal de recepción usa un portal dedicado con su correo y contraseña asignados por el administrador.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => navigate('/recepcion/login')}
                                    className="w-full h-11 bg-primary text-primary-foreground hover:opacity-90 gap-2"
                                >
                                    <ArrowRight className="h-4 w-4" />
                                    Ir al Portal de Recepción
                                </Button>
                            </div>
                        </TabsContent>
                    </Card>
                </Tabs>

                <p className="text-center text-[11px] text-muted-foreground">
                    &copy; 2026 KALLPA Systems. Derechos Reservados.
                </p>
            </motion.div>
        </div>
    );
};

// Wrapper para Card porque necesitamos usar el componente Card del UI
const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={cn("rounded-2xl border bg-card text-card-foreground shadow", className)}>
        {children}
    </div>
);

export default Login;

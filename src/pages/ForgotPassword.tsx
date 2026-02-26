import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dumbbell, Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Por favor ingresa tu correo electrónico");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // redirectTo: origin + '/update-password',
                // Supabase usará el Site URL por defecto o el Return URL configurado.
            });

            if (error) {
                toast.error("Error al enviar el correo: " + error.message);
            } else {
                setIsSent(true);
                toast.success("Correo de recuperación enviado con éxito");
            }
        } catch (error) {
            toast.error("Error inesperado de comunicación");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[400px] space-y-8"
            >
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-6">
                        <Link to="/login">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center shadow-lg mx-auto"
                            >
                                <Dumbbell className="h-8 w-8 text-muted-foreground" />
                            </motion.div>
                        </Link>
                    </div>
                    <h1 className="text-3xl font-display tracking-tight text-foreground">Recuperar Acceso</h1>
                    <p className="text-sm text-muted-foreground font-medium">Restablecer tu contraseña administrativa</p>
                </div>

                <div className="rounded-2xl border bg-card/40 text-card-foreground shadow-2xl backdrop-blur-xl p-6 sm:p-8">
                    {!isSent ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico (Admin)</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
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
                                <p className="text-[10px] text-muted-foreground mt-2">
                                    Te enviaremos un "Enlace Mágico" (Magic Link) para restablecer la seguridad de tu base de datos de forma segura.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className={cn(
                                    "w-full h-11 text-sm font-semibold transition-all duration-300 gap-2 bg-foreground text-background hover:bg-foreground/80"
                                )}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Enviando email...
                                    </>
                                ) : (
                                    <>
                                        Solicitar Enlace de Recuperación
                                    </>
                                )}
                            </Button>

                            <div className="text-center pt-2">
                                <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground underline">
                                    Volver al login
                                </Link>
                            </div>
                        </form>
                    ) : (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-4">
                            <div className="mx-auto w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center">
                                <Mail className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Revisa tu Bandeja</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Hemos enviado un enlace de recuperación seguro a:<br />
                                    <span className="font-medium text-foreground">{email}</span>
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => setIsSent(false)} className="w-full">
                                Intentar con otro correo
                            </Button>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;

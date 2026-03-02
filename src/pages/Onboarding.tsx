import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const Onboarding = () => {
    const [companyName, setCompanyName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, setTenantId } = useAuth();
    const navigate = useNavigate();

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const finalName = companyName.trim() || user.name || "Mi Gimnasio";
        const slug = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

        setIsSubmitting(true);
        try {
            // 1. Insertar Tenant oficial en la BD
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .insert({ name: finalName, slug })
                .select()
                .single();

            if (tenantError) throw tenantError;

            // 2. Pre-crear la fila de settings para evitar 404 en Settings
            await supabase.from('gym_settings').insert({ tenant_id: tenantData.id });

            // 3. Crear planes predeterminados
            await supabase.from('membership_plans').insert([
                { tenant_id: tenantData.id, name: 'Básico', description: 'Acceso general guiado', price: 100, duration_days: 30, color: '#3b82f6', is_active: true },
                { tenant_id: tenantData.id, name: 'Estándar', description: 'Acceso general + clases grupales', price: 150, duration_days: 30, color: '#8b5cf6', is_active: true },
                { tenant_id: tenantData.id, name: 'Premium', description: 'Acceso total VIP y nutrición', price: 200, duration_days: 30, color: '#f59e0b', is_active: true }
            ]);

            // 4. Vincular Tenant al perfil
            await setTenantId(tenantData.id);

            toast.success("¡Espacio de trabajo creado!");
            navigate("/dashboard", { replace: true });
        } catch (error: any) {
            toast.error("Error al crear empresa: " + (error.message || "Intenta nuevamente"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-coral/5 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-[480px]"
            >
                <div className="text-center space-y-4 mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                        <Sparkles className="h-3 w-3" />
                        Configuración Inicial
                    </div>
                    <h1 className="text-4xl font-display tracking-tight text-foreground">Bienvenido a KALLPA</h1>
                    <p className="text-muted-foreground text-sm">Comencemos configurando tu espacio de trabajo.</p>
                </div>

                <form
                    onSubmit={handleComplete}
                    className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl space-y-6"
                >
                    <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-lg">¿Cómo se llama tu gimnasio?</Label>
                        <p className="text-xs text-muted-foreground">Este nombre aparecerá en tus reportes y barra lateral. (Opcional)</p>
                        <div className="relative group pt-2">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                id="companyName"
                                placeholder="Ej. Iron Temple Gym"
                                className="h-14 pl-12 bg-secondary/30 border-border/50 text-lg focus:ring-primary/20"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:opacity-90 glow-volt gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Creando Espacio...
                            </>
                        ) : (
                            <>
                                Crear mi Gimnasio
                                <ArrowRight className="h-5 w-5" />
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-8 flex justify-center items-center gap-6 text-muted-foreground/40">
                    <div className="h-[1px] w-12 bg-border/50" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">KALLPA SECURITY</span>
                    <div className="h-[1px] w-12 bg-border/50" />
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Upload, ArrowRight, CheckCircle2, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const Onboarding = () => {
    const [step, setStep] = useState(1);
    const [companyName, setCompanyName] = useState("");
    const [logo, setLogo] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, setTenantId } = useAuth();
    const navigate = useNavigate();

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleComplete = async () => {
        if (!user) return;

        // Si no ingresó nombre y decidió "Omitir" o Completar igual
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

            // 2. Pre-crear la fila de settings (Opcional, pero previene bugs si se salta)
            await supabase.from('gym_settings').insert({ tenant_id: tenantData.id });

            // 3. Crear planes predeterminados
            await supabase.from('membership_plans').insert([
                { tenant_id: tenantData.id, name: 'Básico', description: 'Acceso general guiado', price: 100, duration_days: 30, color: '#3b82f6', is_active: true },
                { tenant_id: tenantData.id, name: 'Estándar', description: 'Acceso general + clases grupales', price: 150, duration_days: 30, color: '#8b5cf6', is_active: true },
                { tenant_id: tenantData.id, name: 'Premium', description: 'Acceso total VIP y nutrición', price: 200, duration_days: 30, color: '#f59e0b', is_active: true }
            ]);

            // 4. Otorgar licencia de prueba gratuita de 3 días
            const trialCode = `TRIAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            await supabase.from('licenses').insert({
                code: trialCode,
                status: 'redeemed', // Ya canjeada automáticamente
                redeemed_by: tenantData.id,
                redeemed_at: new Date().toISOString(),
                duration_months: 0, // Identificador de que es la prueba
            });

            // 5. Vincular Tenant al perfil
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
            {/* Elementos decorativos de fondo */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-coral/5 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-[500px]"
            >
                <div className="text-center space-y-4 mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
                        <Sparkles className="h-3 w-3" />
                        Configuración Inicial
                    </div>
                    <h1 className="text-4xl font-display tracking-tight text-foreground">Bienvenido a KALLPA</h1>
                    <p className="text-muted-foreground text-sm">Comencemos configurando tu espacio de trabajo.</p>
                </div>

                <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl relative">
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-secondary/30 rounded-t-3xl overflow-hidden">
                        <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: step === 1 ? "50%" : "100%" }}
                            className="h-full bg-primary glow-volt"
                        />
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6 pt-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="companyName" className="text-lg">¿Cómo se llama tu gimnasio?</Label>
                                    <p className="text-xs text-muted-foreground">Este nombre aparecerá en tus facturas, reportes y barra lateral. (Opcional)</p>
                                    <div className="relative group pt-2">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="companyName"
                                            placeholder="Ej. Iron Temple Gym"
                                            className="h-14 pl-12 bg-secondary/30 border-border/50 text-lg focus:ring-primary/20"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setStep(2)}
                                    className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:opacity-90 glow-volt gap-2"
                                >
                                    Siguiente Paso
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6 pt-4"
                            >
                                <div className="space-y-2 text-center">
                                    <Label className="text-xl font-display block">Sube tu Logo</Label>
                                    <p className="text-sm text-muted-foreground">Personaliza el sistema con el logo de tu gimnasio. Puedes hacerlo después.</p>

                                    <div className="flex justify-center pt-6">
                                        <div className="relative">
                                            <div className={cn(
                                                "h-32 w-32 rounded-3xl border-2 border-dashed border-border/50 bg-secondary/20 flex items-center justify-center overflow-hidden transition-all",
                                                logo && "border-solid border-primary/50 bg-primary/5"
                                            )}>
                                                {logo ? (
                                                    <img src={logo} alt="Logo" className="h-full w-full object-contain p-4" />
                                                ) : (
                                                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                                                )}
                                            </div>
                                            <label
                                                htmlFor="logo-upload"
                                                className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg"
                                            >
                                                <Upload className="h-5 w-5" />
                                                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                                            </label>
                                            {logo && (
                                                <button
                                                    onClick={() => setLogo(null)}
                                                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md z-10"
                                                    title="Quitar foto"
                                                >
                                                    <span className="font-bold text-lg leading-none mb-0.5">×</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 pt-4">
                                    <Button
                                        onClick={handleComplete}
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
                                                Finalizar
                                                <CheckCircle2 className="h-5 w-5" />
                                            </>
                                        )}
                                    </Button>

                                    {!logo && (
                                        <button
                                            onClick={handleComplete}
                                            disabled={isSubmitting}
                                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
                                        >
                                            Omitir foto
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
                                    >
                                        Volver
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

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

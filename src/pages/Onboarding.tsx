import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2, Sparkles, Upload, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const Onboarding = () => {
    const [companyName, setCompanyName] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user, setTenantId } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Por favor selecciona una imagen válida");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("La imagen no debe superar 2MB");
            return;
        }
        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Lógica principal de creación del espacio de trabajo (desacoplada del evento)
    const runSetup = async () => {
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

            // 2. Vincular Tenant al perfil INMEDIATAMENTE
            await setTenantId(tenantData.id);

            // 3. Subir logo si se proporcionó
            let logoUrl: string | null = null;
            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `${tenantData.id}/logo.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('gym_logos')
                    .upload(fileName, logoFile, { upsert: true });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('gym_logos')
                        .getPublicUrl(fileName);
                    logoUrl = publicUrl;
                }
            }

            // 4. Pre-crear la fila de settings (con logo si se subió)
            // upsert en vez de insert para evitar fallo si la fila ya existe (doble submit)
            await supabase.from('gym_settings').upsert({
                tenant_id: tenantData.id,
                ...(logoUrl ? { logo_url: logoUrl } : {})
            }, { onConflict: 'tenant_id' });

            // 5. Crear planes predeterminados
            await supabase.from('membership_plans').insert([
                { tenant_id: tenantData.id, name: 'Básico', description: 'Acceso general guiado', price: 100, duration_days: 30, color: '#3b82f6', is_active: true },
                { tenant_id: tenantData.id, name: 'Estándar', description: 'Acceso general + clases grupales', price: 150, duration_days: 30, color: '#8b5cf6', is_active: true },
                { tenant_id: tenantData.id, name: 'Premium', description: 'Acceso total VIP y nutrición', price: 200, duration_days: 30, color: '#f59e0b', is_active: true }
            ]);

            toast.success("¡Espacio de trabajo creado!");
            navigate("/dashboard", { replace: true });
        } catch (error: any) {
            toast.error("Error al crear empresa: " + (error.message || "Intenta nuevamente"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        runSetup();
    };

    const handleSkip = () => {
        runSetup();
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
                    onSubmit={handleSubmit}
                    className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl space-y-6"
                >
                    {/* Logo Upload */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Logo de tu Gimnasio{" "}
                            <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <div className="flex items-center gap-4">
                            {/* Preview box */}
                            <div
                                onClick={() => !logoPreview && fileInputRef.current?.click()}
                                className={`h-20 w-20 rounded-2xl border-2 border-dashed flex items-center justify-center shrink-0 transition-all overflow-hidden ${logoPreview
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-border/50 bg-secondary/20 cursor-pointer hover:border-primary/40 hover:bg-primary/5"
                                    }`}
                            >
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                        <ImageIcon className="h-6 w-6" />
                                        <span className="text-[10px]">Logo</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-2">
                                {logoPreview ? (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs text-muted-foreground truncate">{logoFile?.name}</p>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex-1 text-xs h-8 rounded-xl border-border/50"
                                            >
                                                <Upload className="h-3 w-3 mr-1" /> Cambiar
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeLogo}
                                                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full text-xs h-9 rounded-xl border-border/50 hover:border-primary/40"
                                        >
                                            <Upload className="h-3.5 w-3.5 mr-2" />
                                            Subir logo
                                        </Button>
                                        <p className="text-[10px] text-muted-foreground">PNG, JPG o SVG. Máx 2MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoChange}
                        />
                    </div>

                    {/* Nombre del gimnasio */}
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

                    {/* Botón principal */}
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

                    {/* Omitir */}
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSkip}
                        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                    >
                        Omitir y configurar después →
                    </button>
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

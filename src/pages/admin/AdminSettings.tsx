import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, Mail, User } from "lucide-react";

export default function AdminSettings() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });

    /** Pre-rellena el formulario con el nombre y email del superadmin cuando el perfil está disponible. */
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || "",
                email: user.email || ""
            }));
        }
    }, [user]);

    /**
     * Guarda los cambios del perfil del superadmin.
     * 1. Si el nombre cambió → actualiza `profiles.full_name` y `auth.user_metadata`.
     * 2. Si se proporcionó contraseña → valida coincidencia y mínimo 6 caracteres,
     *    luego llama a `supabase.auth.updateUser({ password })`.
     * Nota: los campos de contraseña están pendientes de renderizar en el formulario.
     */
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Update name via profile
            if (formData.name && formData.name !== user?.name) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ full_name: formData.name })
                    .eq('id', user?.id);

                if (profileError) throw profileError;

                // Update user metadata so the next auth grab reflects this
                await supabase.auth.updateUser({
                    data: { name: formData.name }
                });
            }

            // 2. Update password if provided
            if (formData.password) {
                if (formData.password !== formData.confirmPassword) {
                    toast.error("Las contraseñas no coinciden");
                    setLoading(false);
                    return;
                }

                if (formData.password.length < 6) {
                    toast.error("La contraseña debe ser de al menos 6 caracteres");
                    setLoading(false);
                    return;
                }

                const { error: authError } = await supabase.auth.updateUser({
                    password: formData.password
                });

                if (authError) throw authError;
            }

            toast.success("Configuración maestra actualizada");
            setFormData(prev => ({ ...prev, password: "", confirmPassword: "" }));

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "No se pudo actualizar la configuración");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6 max-w-4xl mx-auto w-full py-8 px-6">
                <div>
                    <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-coral" />
                        Configuración Master
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona las credenciales de seguridad y opciones globales de la plataforma KALLPA.
                    </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    <div className="border-b border-border/30 px-6 py-4 bg-secondary/10">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Credenciales de Acceso
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Actualiza tu nombre de administrador o cambia tu contraseña maestra.
                        </p>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Correo Electrónico (Solo Lectura)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        disabled
                                        value={formData.email}
                                        className="w-full rounded-lg border border-border bg-secondary/30 pl-10 px-4 py-2 text-sm opacity-70 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nombre Público</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Ej. KALLPA Admin"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Guardar Cambios
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}

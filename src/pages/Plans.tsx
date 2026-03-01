import { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    Plus, Tag, Clock, DollarSign, Pencil, Trash2, Loader2,
    ToggleLeft, ToggleRight, Tags, CheckCircle2
} from "lucide-react";

const PRESET_COLORS = [
    "#7C3AED", "#2563EB", "#059669", "#D97706",
    "#DC2626", "#DB2777", "#0891B2", "#65A30D",
];

type Plan = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_days: number;
    color: string;
    is_active: boolean;
    created_at: string;
};

const defaultForm = {
    name: "",
    description: "",
    price: "",
    duration_days: "30",
    color: "#7C3AED",
};

const Plans = () => {
    const { user } = useAuth();
    const { requireSubscription } = useSubscription();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState(defaultForm);

    const { data: plans = [], isLoading } = useQuery<Plan[]>({
        queryKey: ["membership_plans", user?.tenantId],
        queryFn: async () => {
            if (!user?.tenantId) return [];
            const { data, error } = await supabase
                .from("membership_plans")
                .select("*")
                .eq("tenant_id", user.tenantId)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user?.tenantId,
    });

    const openCreate = () => {
        setEditingPlan(null);
        setForm(defaultForm);
        setIsModalOpen(true);
    };

    const openEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setForm({
            name: plan.name,
            description: plan.description || "",
            price: String(plan.price),
            duration_days: String(plan.duration_days),
            color: plan.color,
        });
        setIsModalOpen(true);
    };

    const savePlan = useMutation({
        mutationFn: async () => {
            if (!requireSubscription()) throw new Error('sin_licencia');
            if (!user?.tenantId) throw new Error("Sin tenant");
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                price: parseFloat(form.price) || 0,
                duration_days: parseInt(form.duration_days) || 30,
                color: form.color,
                tenant_id: user.tenantId,
            };
            if (editingPlan) {
                const { error } = await supabase
                    .from("membership_plans")
                    .update({ ...payload })
                    .eq("id", editingPlan.id)
                    .eq("tenant_id", user.tenantId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("membership_plans")
                    .insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership_plans"] });
            toast.success(editingPlan ? "Plan actualizado" : "Plan creado");
            setIsModalOpen(false);
        },
        onError: (e: any) => toast.error(e.message),
    });

    const toggleActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            if (!requireSubscription()) throw new Error('sin_licencia');
            const { error } = await supabase
                .from("membership_plans")
                .update({ is_active: !is_active })
                .eq("id", id)
                .eq("tenant_id", user?.tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership_plans"] });
            toast.success("Estado actualizado");
        },
        onError: (e: any) => toast.error(e.message),
    });

    const deletePlan = useMutation({
        mutationFn: async (id: string) => {
            if (!requireSubscription()) throw new Error('sin_licencia');
            const { error } = await supabase
                .from("membership_plans")
                .delete()
                .eq("id", id)
                .eq("tenant_id", user?.tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership_plans"] });
            toast.success("Plan eliminado");
        },
        onError: (e: any) => toast.error(e.message),
    });

    const createDefaultPlans = useMutation({
        mutationFn: async () => {
            if (!requireSubscription()) throw new Error('sin_licencia');
            if (!user?.tenantId) throw new Error("Sin tenant");

            const defaultPlans = [
                { tenant_id: user.tenantId, name: 'Básico', description: 'Acceso general guiado', price: 100, duration_days: 30, color: '#3b82f6', is_active: true },
                { tenant_id: user.tenantId, name: 'Estándar', description: 'Acceso general + clases grupales', price: 150, duration_days: 30, color: '#8b5cf6', is_active: true },
                { tenant_id: user.tenantId, name: 'Premium', description: 'Acceso total VIP y nutrición', price: 200, duration_days: 30, color: '#f59e0b', is_active: true }
            ];

            const { error } = await supabase.from("membership_plans").insert(defaultPlans);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership_plans"] });
            toast.success("Planes predeterminados creados");
        },
        onError: (e: any) => toast.error(e.message),
    });

    const activePlans = plans.filter(p => p.is_active);
    const inactivePlans = plans.filter(p => !p.is_active);

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 sm:gap-4"
                >
                    <div>
                        <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-tight">
                            Planes de Membresía
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {isLoading ? "Cargando..." : `${activePlans.length} planes activos configurados`}
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            if (requireSubscription()) {
                                openCreate();
                            }
                        }}
                        className="bg-primary text-primary-foreground hover:opacity-90 shadow-lg glow-volt gap-2 w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4" /> Nuevo Plan
                    </Button>
                </motion.div>

                {/* Empty State */}
                {!isLoading && plans.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-24 border border-dashed border-border/50 rounded-2xl bg-card/30 gap-4"
                    >
                        <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20">
                            <Tags className="h-10 w-10 text-primary/70" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-foreground">Sin planes creados</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                                Crea tus primeros planes de membresía para asignarlos a tus miembros al registrarse.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                            <Button
                                onClick={() => createDefaultPlans.mutate()}
                                disabled={createDefaultPlans.isPending}
                                variant="outline"
                                className="bg-transparent border-primary/40 text-primary hover:bg-primary/10 gap-2 w-full sm:w-auto"
                            >
                                {createDefaultPlans.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
                                Generar Planes Predeterminados
                            </Button>
                            <Button
                                onClick={() => {
                                    if (requireSubscription()) {
                                        openCreate();
                                    }
                                }}
                                className="bg-primary text-primary-foreground gap-2 w-full sm:w-auto"
                            >
                                <Plus className="h-4 w-4" /> Crear plan desde cero
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Active Plans Grid */}
                {activePlans.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                            Planes Activos
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <AnimatePresence>
                                {activePlans.map((plan) => (
                                    <PlanCard
                                        key={plan.id}
                                        plan={plan}
                                        onEdit={() => openEdit(plan)}
                                        onToggle={() => toggleActive.mutate({ id: plan.id, is_active: plan.is_active })}
                                        onDelete={() => deletePlan.mutate(plan.id)}
                                        isLoading={toggleActive.isPending || deletePlan.isPending}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Inactive Plans */}
                {inactivePlans.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                            Planes Desactivados
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                            {inactivePlans.map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    onEdit={() => openEdit(plan)}
                                    onToggle={() => toggleActive.mutate({ id: plan.id, is_active: plan.is_active })}
                                    onDelete={() => deletePlan.mutate(plan.id)}
                                    isLoading={toggleActive.isPending || deletePlan.isPending}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal crear/editar */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-border/50 bg-secondary/20">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Tag className="h-5 w-5 text-primary" />
                            {editingPlan ? "Editar Plan" : "Nuevo Plan de Membresía"}
                        </h2>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="p-name">Nombre del Plan <span className="text-coral">*</span></Label>
                            <Input
                                id="p-name"
                                placeholder="Ej. Mensual Estándar"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="bg-secondary/30"
                            />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label htmlFor="p-desc">Descripción</Label>
                            <Input
                                id="p-desc"
                                placeholder="Ej. Acceso ilimitado + clases grupales"
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="bg-secondary/30"
                            />
                        </div>

                        {/* Precio y Duración */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="p-price">
                                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Precio</span>
                                </Label>
                                <Input
                                    id="p-price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={form.price}
                                    onChange={e => setForm({ ...form, price: e.target.value })}
                                    className="bg-secondary/30 font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="p-days">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Duración (días)</span>
                                </Label>
                                <Input
                                    id="p-days"
                                    type="number"
                                    min="1"
                                    placeholder="30"
                                    value={form.duration_days}
                                    onChange={e => setForm({ ...form, duration_days: e.target.value })}
                                    className="bg-secondary/30 font-mono"
                                />
                            </div>
                        </div>

                        {/* Color */}
                        <div className="space-y-2">
                            <Label>Color del Plan</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm({ ...form, color: c })}
                                        className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: form.color === c ? "white" : "transparent",
                                            boxShadow: form.color === c ? `0 0 0 2px ${c}` : "none",
                                        }}
                                    >
                                        {form.color === c && (
                                            <CheckCircle2 className="h-4 w-4 text-white absolute inset-0 m-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div
                            className="p-4 rounded-xl border flex items-center justify-between"
                            style={{ borderColor: form.color + "50", background: form.color + "15" }}
                        >
                            <div>
                                <p className="font-semibold text-foreground">{form.name || "Nombre del plan"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {form.duration_days || 30} días · {form.description || "Sin descripción"}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-display font-bold" style={{ color: form.color }}>
                                    S/{parseFloat(form.price || "0").toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-0 flex gap-3">
                        <Button
                            variant="outline"
                            className="w-full bg-transparent border-border hover:bg-secondary"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="w-full bg-primary text-primary-foreground hover:opacity-90 glow-volt shadow-lg"
                            disabled={savePlan.isPending || !form.name}
                            onClick={() => savePlan.mutate()}
                        >
                            {savePlan.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...</>
                            ) : (
                                editingPlan ? "Guardar Cambios" : "Crear Plan"
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

/* ---- PlanCard Sub-Component ---- */
const PlanCard = ({
    plan, onEdit, onToggle, onDelete, isLoading
}: {
    plan: Plan;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
    isLoading: boolean;
}) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
    >
        <Card className="border-border/50 bg-card/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            {/* Color strip */}
            <div className="h-1.5 w-full" style={{ backgroundColor: plan.color }} />
            <CardHeader className="pb-3 pt-3 px-4 sm:pt-4 sm:px-5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className="p-1 sm:p-1.5 rounded-lg shrink-0" style={{ backgroundColor: plan.color + "20" }}>
                            <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: plan.color }} />
                        </div>
                        <div className="overflow-hidden pr-1">
                            <p className="font-semibold text-foreground text-sm leading-tight truncate">{plan.name}</p>
                            {plan.description && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 max-w-[12rem] sm:max-w-none truncate sm:line-clamp-1">{plan.description}</p>
                            )}
                        </div>
                    </div>
                    <p className="text-base sm:text-xl font-display font-bold shrink-0 mt-0.5 sm:mt-0" style={{ color: plan.color }}>
                        S/{plan.price.toFixed(2)}
                    </p>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 sm:px-5 sm:pb-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                    <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5 shrink-0" />
                    <span className="truncate">{plan.duration_days} días de acceso</span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 pt-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onEdit}
                        className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs hover:bg-secondary gap-1 px-1 sm:px-3"
                    >
                        <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onToggle}
                        disabled={isLoading}
                        className="flex-[1.5] sm:flex-1 h-7 sm:h-8 text-[10px] sm:text-xs gap-1 hover:bg-secondary px-1 sm:px-3"
                    >
                        {plan.is_active
                            ? <><ToggleRight className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-success" /> Activo</>
                            : <><ToggleLeft className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> Inactivo</>
                        }
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDelete}
                        disabled={isLoading}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 shrink-0 text-xs hover:bg-destructive/10 hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    </motion.div>
);

export default Plans;

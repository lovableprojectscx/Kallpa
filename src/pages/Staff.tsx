import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, UserPlus, Shield, Search, Trash2, Mail, Clock } from "lucide-react";

const Staff = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [isNewStaffOpen, setIsNewStaffOpen] = useState(false);
    const [staffToDelete, setStaffToDelete] = useState<{ id: string; name: string } | null>(null);

    // Form State — solo nombre y email (sin contraseña)
    const [fullName, setFullName] = useState("");
    const [staffEmail, setStaffEmail] = useState("");

    // FETCH STAFF — fuente única: profiles con role=staff
    const { data: staffList = [], isLoading } = useQuery({
        queryKey: ['staff', user?.tenantId],
        queryFn: async () => {
            if (!user?.tenantId) return [];
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, status, created_at')
                .eq('tenant_id', user.tenantId)
                .eq('role', 'staff')
                .order('created_at', { ascending: false });
            return data || [];
        },
        enabled: !!user?.tenantId
    });

    // INVITE STAFF — envía email de invitación via Edge Function
    const createStaff = useMutation({
        mutationFn: async () => {
            if (!fullName || !staffEmail) throw new Error("Completa nombre y email.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) throw new Error("Email inválido.");
            if (!user?.tenantId) throw new Error("Sin empresa configurada.");

            const origin = window.location.origin;
            const { data, error } = await supabase.functions.invoke('invite-staff-member', {
                body: {
                    full_name: fullName,
                    email: staffEmail.trim().toLowerCase(),
                    tenant_id: user.tenantId,
                    redirect_url: `${origin}/recepcion/aceptar`,
                },
            });

            if (error) throw new Error(error.message || "Error enviando invitación");
            return data;
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['staff', user?.tenantId] });
            if (data?.status === 'linked') {
                toast.success("Vinculado. Esta persona ya tiene cuenta — puede entrar en /recepcion/login con su contraseña actual.", { duration: 6000 });
            } else {
                toast.success("¡Invitación enviada! El empleado recibirá un email para crear su acceso.", { duration: 5000 });
            }
            setIsNewStaffOpen(false);
            setFullName("");
            setStaffEmail("");
        },
        onError: (error: any) => {
            toast.error(error.message || "No se pudo enviar la invitación.");
        }
    });

    const filteredStaff = staffList.filter((s: any) =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // DELETE STAFF
    const deleteStaff = useMutation({
        mutationFn: async (staffId: string) => {
            if (!user?.tenantId) throw new Error("Sin empresa configurada.");
            const { error } = await supabase.rpc('remove_staff_member', {
                p_user_id: staffId,
                p_tenant_id: user.tenantId,
            });
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff', user?.tenantId] });
            toast.success('Acceso del empleado revocado.');
        },
        onError: (error: any) => {
            toast.error(error.message || 'No se pudo revocar el acceso.');
        }
    });

    return (
        <>
            <div className="space-y-6">
                {/* Encabezado */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Gestión de Personal</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {isLoading ? "Cargando..." : `Administra a los recepcionistas y empleados de tu sistema.`}
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsNewStaffOpen(true)}
                        size="lg"
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 glow-volt shadow-lg gap-2"
                    >
                        <UserPlus className="h-4 w-4" />
                        Añadir Personal
                    </Button>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Buscar personal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 bg-card border-border/50 text-foreground focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Lista de Personal */}
                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-sm text-left">
                            <thead className="bg-secondary/40 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Empleado</th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Rol</th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Email</th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Estado</th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Cargando personal...
                                        </td>
                                    </tr>
                                ) : filteredStaff.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 sm:py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center">
                                                <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30 mb-2 sm:mb-3" />
                                                <span className="text-xs sm:text-sm">No tienes personal registrado. Haz clic en "Añadir Personal".</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStaff.map((staff: any, i: number) => {
                                        const initials = staff.full_name?.substring(0, 2).toUpperCase() || 'ST';

                                        return (
                                            <motion.tr
                                                key={staff.id}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: i * 0.02 }}
                                                className="hover:bg-secondary/20 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500 font-bold shadow-sm">
                                                            {initials}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground">{staff.full_name}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-500">
                                                        Recepción
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                                                    {staff.email || '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {staff.status === 'active'
                                                        ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Activo</span>
                                                        : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400"><Clock className="h-3 w-3" /> Pendiente</span>
                                                    }
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => setStaffToDelete({ id: staff.id, name: staff.full_name })}
                                                        disabled={deleteStaff.isPending}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Quitar acceso
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Confirmar eliminación de staff */}
            <AlertDialog open={!!staffToDelete} onOpenChange={(open) => { if (!open) setStaffToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Revocar acceso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se revocará el acceso de <span className="font-semibold">{staffToDelete?.name}</span> al sistema de recepción. Esta acción puede deshacerse invitándolo nuevamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (staffToDelete) deleteStaff.mutate(staffToDelete.id); setStaffToDelete(null); }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Revocar acceso
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal de Creación */}
            <Dialog open={isNewStaffOpen} onOpenChange={setIsNewStaffOpen}>
                <DialogContent className="sm:max-w-[450px] p-0 border-border/50 bg-card rounded-2xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-6 border-b border-border/50 bg-secondary/20">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Invitar Empleado
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Ingresa el email del recepcionista. Recibirá un link para crear su propia contraseña de acceso.
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullname">Nombre del Empleado <span className="text-coral">*</span></Label>
                            <Input
                                id="fullname"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Ej. Ana de la Recepción"
                                className="bg-secondary/30"
                                disabled={createStaff.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="staffEmail">Email del Empleado <span className="text-coral">*</span></Label>
                            <Input
                                id="staffEmail"
                                type="email"
                                value={staffEmail}
                                onChange={(e) => setStaffEmail(e.target.value)}
                                placeholder="Ej. ana@irongym.com"
                                className="bg-secondary/30"
                                disabled={createStaff.isPending}
                            />
                            <p className="text-[11px] text-muted-foreground">Se enviará un link de activación a este correo. El empleado creará su propia contraseña.</p>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-border/50 bg-secondary/10 flex flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsNewStaffOpen(false)}
                            className="bg-card w-full sm:w-auto"
                            disabled={createStaff.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => createStaff.mutate()}
                            disabled={createStaff.isPending}
                            className="bg-primary text-primary-foreground hover:opacity-90 w-full sm:w-auto glow-volt"
                        >
                            {createStaff.isPending ? "Enviando..." : "Enviar Invitación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Staff;

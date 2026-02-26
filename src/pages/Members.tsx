import { useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, Filter, Plus, QrCode, Smartphone, CheckCircle2, UserPlus, Flame, Pencil, Tag, Loader2, CreditCard, Trash2, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MemberCardModal } from "@/components/MemberCardModal";

const statusMap: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-success/15 text-success" },
  expired: { label: "Vencido", className: "bg-coral/15 text-coral" },
  suspended: { label: "Suspendido", className: "bg-destructive/15 text-destructive" },
  inactive: { label: "Inactivo", className: "bg-secondary text-muted-foreground" },
};

const Members = () => {
  const { user } = useAuth();
  const { requireSubscription } = useSubscription();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("basico");
  const [phone, setPhone] = useState("");

  // QR Modal State
  const [generatedQRMember, setGeneratedQRMember] = useState<{ id: string, name: string, phone?: string } | null>(null);

  // Carnet State
  const [cardMember, setCardMember] = useState<any | null>(null);

  // Edit Modal State
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", status: "active", plan: "", start_date: "", end_date: "" });
  const [deletingMember, setDeletingMember] = useState<any | null>(null);

  // FETCH PLANS
  const { data: membershipPlans = [] } = useQuery({
    queryKey: ['membership_plans', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from('membership_plans')
        .select('id, name, price, duration_days, color')
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenantId,
  });

  // FETCH MEMBERS con última visita
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      // Traer miembros
      const { data: mems, error } = await supabase
        .from('members')
        .select('*')
        .eq('tenant_id', user.tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Traer última visita de cada miembro
      const { data: att } = await supabase
        .from('attendance')
        .select('member_id, check_in_time')
        .eq('tenant_id', user.tenantId)
        .order('check_in_time', { ascending: false });

      // Calcular última visita y racha por miembro
      const lastVisitMap: Record<string, string> = {};
      const streakMap: Record<string, number> = {};

      if (att) {
        att.forEach(a => {
          if (!lastVisitMap[a.member_id]) lastVisitMap[a.member_id] = a.check_in_time;
        });
        // Racha: días únicos consecutivos hasta hoy
        const byMember: Record<string, Set<string>> = {};
        att.forEach(a => {
          if (!byMember[a.member_id]) byMember[a.member_id] = new Set();
          byMember[a.member_id].add(a.check_in_time.slice(0, 10));
        });
        Object.entries(byMember).forEach(([memberId, days]) => {
          const sorted = Array.from(days).sort().reverse();
          let streak = 0;
          let prev = new Date();
          prev.setHours(0, 0, 0, 0);
          for (const d of sorted) {
            const curr = new Date(d);
            const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
            if (diff <= 1) { streak++; prev = curr; } else break;
          }
          streakMap[memberId] = streak;
        });
      }

      return (mems || []).map(m => ({
        ...m,
        last_visit: lastVisitMap[m.id] || null,
        streak: streakMap[m.id] || 0,
      }));
    },
    enabled: !!user?.tenantId
  });

  // CREATE MEMBER
  const createMember = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error('sin_licencia');
      if (!user?.tenantId) throw new Error("No tenant ID");
      const selectedPlan = (membershipPlans as any[]).find(p => p.id === plan);
      const durationDays = selectedPlan?.duration_days || 30;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);

      const { data, error } = await supabase
        .from('members')
        .insert({
          full_name: fullName,
          email,
          plan,
          phone,
          status: 'active',
          tenant_id: user.tenantId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      toast.success("¡Miembro registrado con éxito!");
      setIsNewMemberOpen(false);
      setGeneratedQRMember({ id: data.id, name: data.full_name, phone: data.phone });
      // Reset form
      setFullName(""); setEmail(""); setPlan("basico"); setPhone("");
    },
    onError: (error: any) => {
      if (error.message !== 'sin_licencia') toast.error(error.message || "Error al registrar miembro");
    }
  });

  // UPDATE MEMBER
  const updateMember = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error('sin_licencia');
      const { error } = await supabase
        .from('members')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          status: editForm.status,
          plan: editForm.plan,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null
        })
        .eq('id', editingMember!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Miembro actualizado');
      setEditingMember(null);
    },
    onError: (e: any) => { if (e.message !== 'sin_licencia') toast.error(e.message); },
  });

  // DELETE MEMBER
  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      if (!requireSubscription()) throw new Error('sin_licencia');
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success("Miembro eliminado correctamente");
      setDeletingMember(null);
    },
    onError: (error: any) => {
      if (error.message !== 'sin_licencia') toast.error(error.message || "Error al eliminar miembro");
    }
  });

  const openEdit = (member: any) => {
    setEditingMember(member);
    setEditForm({
      full_name: member.full_name,
      email: member.email || '',
      phone: member.phone || '',
      status: member.status || 'active',
      plan: member.plan || '',
      start_date: member.start_date || '',
      end_date: member.end_date || ''
    });
  };

  const handleEditPlanChange = (newPlanId: string) => {
    const selectedPlan = (membershipPlans as any[]).find(p => p.id === newPlanId);
    const durationDays = selectedPlan?.duration_days || 30;

    // Si ya hay una fecha de inicio seleccionada, usamos esa, sino hoy
    const startDate = editForm.start_date ? new Date(editForm.start_date) : new Date();
    // Ajustamos la zona horaria para que no retroceda un día al parsear YYYY-MM-DD
    startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);

    setEditForm(prev => ({
      ...prev,
      plan: newPlanId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }));
  };

  const handleWhatsApp = () => {
    if (!generatedQRMember) return;
    const portalUrl = `${window.location.origin}/portal/${generatedQRMember.id}`;
    const nombre = generatedQRMember.name.split(" ")[0];
    const text = `¡Hola ${nombre}! 🎉 Bienvenido a tu nuevo gimnasio. 🏋️‍♂️\n\nAquí tienes tu Portal de Miembro, donde podrás ver el estado de tu cuenta, vigencia de tu plan y descargar tu Pase Digital:\n👉 ${portalUrl}\n\n¡A entrenar duro!`;
    const encodedUrl = encodeURIComponent(text);

    // Si tenemos el teléfono, enviamos el mensaje directo a ese número,
    // asegurándonos de limpiar el número de espacios o caracteres especiales si los hubiera.
    if (generatedQRMember.phone) {
      const cleanPhone = generatedQRMember.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodedUrl}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedUrl}`, '_blank');
    }
  };

  const filteredMembers = members.filter((m: any) =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Resolver nombre del plan
  const getPlanName = (planId: string) => {
    const found = (membershipPlans as any[]).find(p => p.id === planId);
    return found ? found.name : planId || '—';
  };

  const getPlanColor = (planId: string) => {
    const found = (membershipPlans as any[]).find(p => p.id === planId);
    return found?.color || '#6b7280';
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Directorio de Miembros</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Cargando..." : `Gestiona tus ${members.length} miembros registrados y visualiza sus pases de acceso.`}
            </p>
          </div>
          <Button
            onClick={() => {
              if (requireSubscription()) {
                setIsNewMemberOpen(true);
              }
            }}
            size="lg"
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:opacity-90 glow-volt shadow-lg gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo Miembro
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nombre o documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50 text-foreground focus:border-primary/50 transition-colors"
            />
          </div>
          <Button variant="outline" className="h-11 border-border/50 bg-card gap-2 text-muted-foreground hover:text-foreground">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
        </div>

        {/* Lista de Miembros */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm text-left">
              <thead className="bg-secondary/40 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Miembro</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Plan</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Estado</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Última Visita</th>
                  <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Racha</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      Cargando base de datos...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No hay miembros registrados todavía. Haz clic en "Nuevo Miembro" para comenzar.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member, i) => {
                    let currentStatus = member.status || 'inactive';
                    if (member.end_date) {
                      const end = new Date(member.end_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      end.setHours(0, 0, 0, 0);
                      if (end < today && currentStatus === 'active') {
                        currentStatus = 'expired';
                      }
                    }
                    const st = statusMap[currentStatus];
                    const initials = member.full_name?.substring(0, 2).toUpperCase() || 'US';
                    const planName = getPlanName(member.plan);
                    const planColor = getPlanColor(member.plan);

                    return (
                      <motion.tr
                        key={member.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                      >
                        {/* Miembro */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-sm">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{member.full_name}</span>
                              <span className="text-[11px] text-muted-foreground">{member.email || member.phone || 'Sin contacto'}</span>
                            </div>
                          </div>
                        </td>
                        {/* Plan */}
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ backgroundColor: planColor + '20', color: planColor }}
                          >
                            <Tag className="h-3 w-3" />
                            {planName}
                          </span>
                        </td>
                        {/* Estado */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", st.className)}>
                              {st.label}
                            </span>
                            {member.end_date && (
                              <span className={cn("text-[10px] pl-1", currentStatus === 'expired' ? "text-red-400 font-medium" : "text-muted-foreground")} title="Fecha de vencimiento del plan">
                                Vence: {format(new Date(member.end_date), "d MMM yy", { locale: es })}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Última visita */}
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {member.last_visit
                            ? format(new Date(member.last_visit), "dd MMM yyyy", { locale: es })
                            : <span className="text-muted-foreground/40 italic">Sin visitas</span>
                          }
                        </td>
                        {/* Racha */}
                        <td className="px-6 py-4">
                          {member.streak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-sm">
                              <Flame className="h-4 w-4" />
                              {member.streak}d
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </td>
                        {/* Acciones */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="Ver Carnet"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!requireSubscription()) return;
                                setCardMember(member);
                              }}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              title="Editar"
                              onClick={(e) => { e.stopPropagation(); openEdit(member); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-[#25D366] hover:bg-[#25D366]/10"
                              title="Enviar Enlace por WhatsApp"
                              onClick={(e) => {
                                e.stopPropagation();
                                const portalUrl = `${window.location.origin}/portal/${member.id}`;
                                const nombre = member.full_name.split(" ")[0];
                                const text = `¡Hola ${nombre}! 🎉 Bienvenido a tu nuevo gimnasio. 🏋️‍♂️\n\nAquí tienes tu Portal de Miembro, donde podrás ver el estado de tu cuenta, vigencia de tu plan y descargar tu Pase Digital:\n👉 ${portalUrl}\n\n¡A entrenar duro!`;
                                const encodedUrl = encodeURIComponent(text);
                                if (member.phone) {
                                  const cleanPhone = member.phone.replace(/\D/g, '');
                                  window.open(`https://wa.me/${cleanPhone}?text=${encodedUrl}`, '_blank');
                                } else {
                                  window.open(`https://wa.me/?text=${encodedUrl}`, '_blank');
                                }
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Eliminar"
                              onClick={(e) => { e.stopPropagation(); setDeletingMember(member); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Modal: Crear Nuevo Miembro */}
      <Dialog open={isNewMemberOpen} onOpenChange={setIsNewMemberOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 border-border/50 bg-card rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-6 border-b border-border/50 bg-secondary/20">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Registrar Miembro
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresa los datos para generar su pase de acceso digital mediante código QR.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullname">Nombre Completo <span className="text-coral">*</span></Label>
              <Input
                id="fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="bg-secondary/30"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="plan">Plan de Membresía</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="plan" className="w-full bg-secondary/30 h-11 border-border/50 hover:bg-secondary/50 transition-colors focus:ring-primary/20">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent className="border-border/50 bg-card rounded-xl shadow-xl select-none">
                  {membershipPlans.length > 0 ? (
                    membershipPlans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="cursor-pointer py-3 focus:bg-secondary/40">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: p.color || '#6b7280' }} />
                          <span className="font-semibold text-foreground text-sm">{p.name}</span>
                          <span className="text-muted-foreground text-xs ml-1 font-medium bg-secondary px-1.5 py-0.5 rounded-md">
                            S/{p.price} / {p.duration_days} días
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="basico" className="cursor-pointer py-3"><span className="font-medium text-sm">Básico (predeterminado)</span></SelectItem>
                      <SelectItem value="estandar" className="cursor-pointer py-3"><span className="font-medium text-sm">Estándar</span></SelectItem>
                      <SelectItem value="premium" className="cursor-pointer py-3"><span className="font-medium text-sm">Premium</span></SelectItem>
                      <SelectItem value="vip" className="cursor-pointer py-3"><span className="font-medium text-sm">VIP</span></SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {membershipPlans.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  · Configura planes reales en <span className="text-primary font-medium">Planes</span> del menú.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+51..."
                  className="bg-secondary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Opcional</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="bg-secondary/30"
                />
              </div>
            </div>
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              className="w-full bg-transparent border-border hover:bg-secondary"
              onClick={() => setIsNewMemberOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="w-full bg-primary text-primary-foreground hover:opacity-90 glow-volt shadow-lg"
              disabled={createMember.isPending || !fullName}
              onClick={() => createMember.mutate()}
            >
              {createMember.isPending ? "Registrando..." : "Registrar y Crear Pase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: QR Generado */}
      <Dialog open={!!generatedQRMember} onOpenChange={(open) => !open && setGeneratedQRMember(null)}>
        <DialogContent className="sm:max-w-md p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8 text-center space-y-6">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 bg-success/15 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h2 className="text-2xl font-display text-foreground">Pase Digital Creado</h2>
              <p className="text-sm text-muted-foreground px-4">
                Pase de acceso de <span className="text-foreground font-semibold">{generatedQRMember?.name}</span>
              </p>
            </div>

            <div className="mx-auto bg-white p-6 rounded-2xl w-fit shadow-inner ring-1 ring-border">
              {generatedQRMember && (
                <QRCode
                  value={generatedQRMember.id}
                  size={200}
                  level="H"
                  className="w-full h-full"
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
              <QrCode className="h-3 w-3" />
              ID: {generatedQRMember?.id.split('-')[0]}
            </p>

            <div className="pt-2 flex flex-col gap-3">
              <Button
                onClick={handleWhatsApp}
                className="w-full h-12 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold transition-colors gap-2 shadow-lg shadow-[#25d366]/20"
              >
                <Smartphone className="h-5 w-5" />
                Enviar Pase por WhatsApp
              </Button>
              <Button
                variant="ghost"
                onClick={() => setGeneratedQRMember(null)}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Cerrar e imprimir luego
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Miembro */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-md p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/20">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Miembro
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="bg-secondary/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+51..." className="bg-secondary/30" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="bg-secondary/30" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plan de Membresía</Label>
              <Select value={editForm.plan} onValueChange={handleEditPlanChange}>
                <SelectTrigger className="w-full bg-secondary/30 h-11 border-border/50 hover:bg-secondary/50 transition-colors focus:ring-primary/20">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent className="border-border/50 bg-card rounded-xl shadow-xl select-none">
                  {(membershipPlans as any[]).length > 0 ? (
                    (membershipPlans as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="cursor-pointer py-3 focus:bg-secondary/40">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: p.color || '#6b7280' }} />
                          <span className="font-semibold text-foreground text-sm">{p.name}</span>
                          <span className="text-muted-foreground text-xs ml-1 font-medium bg-secondary px-1.5 py-0.5 rounded-md">
                            S/{p.price} / {p.duration_days} días
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="basico" className="cursor-pointer py-3">Básico</SelectItem>
                      <SelectItem value="estandar" className="cursor-pointer py-3">Estándar</SelectItem>
                      <SelectItem value="premium" className="cursor-pointer py-3">Premium</SelectItem>
                      <SelectItem value="vip" className="cursor-pointer py-3">VIP</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                <SelectTrigger className="w-full bg-secondary/30 h-11 border-border/50 hover:bg-secondary/50 transition-colors focus:ring-primary/20">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent className="border-border/50 bg-card rounded-xl shadow-xl select-none">
                  <SelectItem value="active" className="cursor-pointer py-2 focus:bg-success/10"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" /><span className="font-medium">Activo</span></div></SelectItem>
                  <SelectItem value="expired" className="cursor-pointer py-2 focus:bg-coral/10"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-coral" /><span className="font-medium">Vencido</span></div></SelectItem>
                  <SelectItem value="suspended" className="cursor-pointer py-2 focus:bg-destructive/10"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /><span className="font-medium">Suspendido</span></div></SelectItem>
                  <SelectItem value="inactive" className="cursor-pointer py-2 focus:bg-secondary"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /><span className="font-medium">Inactivo</span></div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Input type="date" value={editForm.start_date} onChange={e => {
                  const newStartDate = e.target.value;
                  if (!newStartDate || !editForm.plan) {
                    setEditForm({ ...editForm, start_date: newStartDate });
                    return;
                  }
                  // Recalcular el endDate automáticamente al cambiar el startDate
                  const selectedPlan = (membershipPlans as any[]).find(p => p.id === editForm.plan);
                  const durationDays = selectedPlan?.duration_days || 30;

                  const startDate = new Date(newStartDate);
                  startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

                  const endDate = new Date(startDate);
                  endDate.setDate(startDate.getDate() + durationDays);

                  setEditForm({
                    ...editForm,
                    start_date: newStartDate,
                    end_date: endDate.toISOString().split('T')[0]
                  });
                }} className="bg-secondary/30 min-h-11" />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin (Vencimiento)</Label>
                <Input type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} className="bg-secondary/30 min-h-11" />
              </div>
            </div>
          </div>
          <div className="p-6 pt-0 flex gap-3">
            <Button variant="outline" className="w-full" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button
              className="w-full bg-primary text-primary-foreground hover:opacity-90 glow-volt"
              disabled={updateMember.isPending || !editForm.full_name}
              onClick={() => updateMember.mutate()}
            >
              {updateMember.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Carnet Digital */}
      <MemberCardModal
        member={cardMember ? {
          id: cardMember.id,
          full_name: cardMember.full_name,
          plan: cardMember.plan,
          planName: getPlanName(cardMember.plan),
          planColor: getPlanColor(cardMember.plan),
          status: cardMember.status,
          phone: cardMember.phone,
          access_code: cardMember.access_code,
        } : null}
        gymName={user?.email?.split('@')[0] ?? 'Kallpa'}
        onClose={() => setCardMember(null)}
      />

      {/* Alerta de Eliminación */}
      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent className="border-border/50 bg-card rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deletingMember?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al miembro, su registro de asistencia y su pase digital.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border hover:bg-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMember.mutate(deletingMember?.id)}
              disabled={deleteMember.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMember.isPending ? "Eliminando..." : "Sí, Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>

  );
};

export default Members;

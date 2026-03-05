import { useState, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Search, Plus, QrCode, Smartphone, CheckCircle2, UserPlus, Flame, Pencil, Tag, Loader2, CreditCard, Trash2, MessageCircle, FileDown, FileUp, RefreshCw, CalendarPlus, AlertCircle, RotateCcw, Clock } from "lucide-react";
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
import MemberPhotoCapture from "@/components/MemberPhotoCapture";
import * as XLSX from "xlsx";

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
  const [plan, setPlan] = useState(""); // Auto-seleccionado por useEffect cuando cargan los planes
  const [phone, setPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // QR Modal State
  const [generatedQRMember, setGeneratedQRMember] = useState<{ id: string, name: string, phone?: string } | null>(null);

  // Carnet State
  const [cardMember, setCardMember] = useState<any | null>(null);

  // Edit Modal State
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", status: "active", plan: "", start_date: "", end_date: "" });
  const [deletingMember, setDeletingMember] = useState<any | null>(null);

  // Quick Renew state
  const [renewingMember, setRenewingMember] = useState<any | null>(null);
  const [renewPlanId, setRenewPlanId] = useState("");
  const [renewMode, setRenewMode] = useState<'today' | 'extend'>('today');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

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
    staleTime: 1000 * 60 * 10, // Planes raramente cambian — 10 min de caché
    refetchOnWindowFocus: false,
  });

  // Auto-seleccionar el primer plan activo cuando el formulario esta sin plan válido
  useEffect(() => {
    if (membershipPlans.length > 0 && !membershipPlans.find(p => p.id === plan)) {
      setPlan(membershipPlans[0].id);
    }
  }, [membershipPlans]);

  // Pre-cargar plan del miembro al abrir modal de renovación
  useEffect(() => {
    if (renewingMember) {
      setRenewPlanId(renewingMember.plan || (membershipPlans as any[])[0]?.id || "");
      setRenewMode('today');
    }
  }, [renewingMember]);

  // FETCH MEMBERS con última visita
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      // Delegar la carga y cálculo a la base de datos (Supabase RPC)
      // para evitar descargar todo el historial de asistencias al navegador.
      const { data: membersWithStats, error } = await supabase.rpc('get_members_with_stats', {
        p_tenant_id: user.tenantId
      });

      if (error) {
        console.error("Error al obtener los miembros con estadísticas (RPC):", error);
        throw error;
      }

      return membersWithStats || [];
    },
    enabled: !!user?.tenantId,
    staleTime: 1000 * 60 * 2, // 2 min de caché — evita recarga en cada visita a la página
    placeholderData: (prev: any) => prev, // Mantener lista visible durante refresco
    refetchOnWindowFocus: false,
  });

  const handleExportExcel = () => {
    if (!members || members.length === 0) {
      toast.error("No hay miembros para exportar");
      return;
    }

    try {
      // Preparar datos para Excel
      const exportData = members.map(m => {
        const selectedPlan = membershipPlans.find(p => p.id === m.plan);
        const planName = selectedPlan ? selectedPlan.name : "Sin Plan";
        const membershipEndDate = m.end_date ? new Date(m.end_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysRemaining = membershipEndDate ? Math.max(0, Math.ceil((membershipEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 0;

        return {
          "Nombre Completo": m.full_name,
          "Email": m.email || "N/A",
          "Teléfono": m.phone || "N/A",
          "Plan": planName,
          "Estado": m.status === 'active' ? "Activo" : "Inactivo",
          "Fecha Inicio": m.start_date ? new Date(m.start_date).toLocaleDateString() : "N/A",
          "Fecha Fin": m.end_date ? new Date(m.end_date).toLocaleDateString() : "N/A",
          "Días Restantes": daysRemaining,
          "Creado el": new Date(m.created_at).toLocaleDateString()
        };
      });

      // Crear libro y hoja
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Miembros");

      // Ajustar anchos de columna automáticamente
      const wscols = [
        { wch: 30 }, // Nombre
        { wch: 30 }, // Email
        { wch: 15 }, // Teléfono
        { wch: 20 }, // Plan
        { wch: 10 }, // Estado
        { wch: 15 }, // Fecha Inicio
        { wch: 15 }, // Fecha Fin
        { wch: 15 }, // Días
        { wch: 15 }  // Creado
      ];
      ws['!cols'] = wscols;

      // Descargar archivo
      XLSX.writeFile(wb, `Lista_Miembros_Kallpa_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Lista exportada correctamente");
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      toast.error("Error al generar el archivo Excel");
    }
  };

  const handleDownloadTemplate = () => {
    // Generar formato de plantilla para facilitar la importación
    const templateData = [
      {
        "Nombre Completo": "Ejemplo Juan Perez",
        "Email": "juan@ejemplo.com",
        "Teléfono": "987654321",
        "Plan": membershipPlans[0]?.name || "Mensual",
        "Días de Plan (Vigencia)": 30
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Importacion");

    // Configurar el ancho esperado de columnas
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];

    XLSX.writeFile(wb, "Formato_Importar_Miembros.xlsx");
    toast.success("Formato descargado");
  };

  const processImportFile = async () => {
    if (!importFile) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    if (!requireSubscription()) return;

    setIsImporting(true);
    try {
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error("El archivo está vacío");
        setIsImporting(false);
        return;
      }

      // Mapear planes por nombre para fácil referencia  (Ignorando minúsculas)
      const planMap = new Map<string, any>();
      membershipPlans.forEach(p => {
        planMap.set(p.name.toLowerCase(), p);
      });

      // Crear el array de inserción para Supabase
      const insertData = jsonData.map(row => {
        const nombre = row["Nombre Completo"] || row["nombre"] || row["Name"] || "";
        const cEmail = row["Email"] || row["email"] || row["Correo"] || "";
        const telefono = row["Teléfono"] || row["telefono"] || row["Phone"] || "";

        let planBuscado = row["Plan"] || row["plan"] || "";
        let days = parseInt(row["Días de Plan (Vigencia)"] || row["dias"] || "30") || 30;

        // Encontrar plan (o fallback al primer plan creado)
        let resolvedPlanId = membershipPlans[0]?.id || null;
        if (planBuscado) {
          const match = planMap.get(String(planBuscado).toLowerCase().trim());
          if (match) {
            resolvedPlanId = match.id;
            days = match.duration_days || days;
          }
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + days);

        return {
          tenant_id: user?.tenantId,
          full_name: nombre.trim(),
          email: cEmail.trim() || null,
          phone: String(telefono).trim() || null,
          plan: resolvedPlanId,
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        };
      }).filter(m => m.full_name); // Filtrar líneas vacías sin nombre

      if (insertData.length === 0) {
        toast.error("No se encontraron registros válidos en el archivo");
        setIsImporting(false);
        return;
      }

      const { error } = await supabase
        .from('members')
        .insert(insertData);

      if (error) throw error;

      toast.success(`¡Se importaron ${insertData.length} miembros exitosamente!`);
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      setIsImportModalOpen(false);
      setImportFile(null);
    } catch (error: any) {
      console.error("Error importando excel:", error);
      toast.error("Hubo un error al procesar el archivo Excel. Verifica el formato.", {
        description: error.message
      });
    } finally {
      setIsImporting(false);
    }
  };

  // CREATE MEMBER
  const createMember = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error('sin_licencia');
      if (!user?.tenantId) throw new Error("No tenant ID");

      let photoUrl = null;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user.tenantId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('member_photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('member_photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      const selectedPlan = (membershipPlans as any[]).find(p => p.id === plan);
      const durationDays = selectedPlan?.duration_days || 30;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr   = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('members')
        .insert({
          full_name: fullName,
          email: email.trim() || null,
          plan,
          phone: phone.trim() || null,
          status: 'active',
          tenant_id: user.tenantId,
          photo_url: photoUrl,
          start_date: startDateStr,
          end_date: endDateStr
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar pago inmutable para reportes de ventas
      await supabase.from('payments').insert({
        tenant_id: user.tenantId,
        member_id: data.id,
        plan_id: selectedPlan?.id || null,
        plan_name: selectedPlan?.name || 'Sin plan',
        amount: selectedPlan?.price || 0,
        payment_date: startDateStr,
        period_start: startDateStr,
        period_end: endDateStr,
        payment_type: 'new',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      toast.success("¡Miembro registrado con éxito!");
      setIsNewMemberOpen(false);
      setGeneratedQRMember({ id: data.id, name: data.full_name, phone: data.phone });
      // Reset form
      setFullName(""); setEmail(""); setPlan("basico"); setPhone(""); setPhotoFile(null);
    },
    onError: (error: any) => {
      if (error.message !== 'sin_licencia') toast.error(error.message || "Error al registrar miembro");
    }
  });

  // UPDATE MEMBER
  const updateMember = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error('sin_licencia');

      let photoUrl = editingMember?.photo_url;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user?.tenantId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('member_photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('member_photos')
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('members')
        .update({
          full_name: editForm.full_name,
          email: editForm.email?.trim() || null,
          phone: editForm.phone?.trim() || null,
          status: editForm.status,
          plan: editForm.plan,
          photo_url: photoUrl,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null
        })
        .eq('id', editingMember!.id)
        .eq('tenant_id', user?.tenantId);
      if (error) throw error;

      // Registrar pago solo si cambió start_date (nueva renovación o cambio de plan con nueva vigencia)
      const isNewPeriod = editForm.start_date && editForm.start_date !== editingMember!.start_date;
      if (isNewPeriod && user?.tenantId) {
        const newPlan = (membershipPlans as any[]).find(p => p.id === editForm.plan);
        const oldPlan = (membershipPlans as any[]).find(p => p.id === editingMember!.plan);
        const planChanged = editForm.plan !== editingMember!.plan;
        let paymentType: 'renewal' | 'upgrade' | 'downgrade' = 'renewal';
        if (planChanged && newPlan && oldPlan) {
          paymentType = newPlan.price > oldPlan.price ? 'upgrade' : newPlan.price < oldPlan.price ? 'downgrade' : 'renewal';
        }
        await supabase.from('payments').insert({
          tenant_id: user.tenantId,
          member_id: editingMember!.id,
          plan_id: newPlan?.id || null,
          plan_name: newPlan?.name || 'Sin plan',
          amount: newPlan?.price || 0,
          payment_date: editForm.start_date,
          period_start: editForm.start_date,
          period_end: editForm.end_date || null,
          payment_type: paymentType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      toast.success('Miembro actualizado');
      setEditingMember(null);
      setPhotoFile(null);
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
        .eq('id', id)
        .eq('tenant_id', user?.tenantId); // Seguridad extra: solo el propio tenant
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      toast.success("Miembro eliminado correctamente");
      setDeletingMember(null);
    },
    onError: (error: any) => {
      if (error.message !== 'sin_licencia') toast.error(error.message || "Error al eliminar miembro");
    }
  });

  // QUICK RENEW — sin abrir el modal de edición completo
  const quickRenewMember = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error('sin_licencia');
      if (!renewingMember || !user?.tenantId) throw new Error("Datos incompletos");

      const selectedPlan = (membershipPlans as any[]).find(p => p.id === renewPlanId);
      const durationDays = selectedPlan?.duration_days || 30;

      let startDate: Date;
      const today = new Date(); today.setHours(0, 0, 0, 0);

      if (renewMode === 'today') {
        startDate = new Date();
      } else {
        if (renewingMember.end_date) {
          const currentEnd = new Date(renewingMember.end_date + 'T00:00:00');
          startDate = currentEnd > today ? new Date(currentEnd) : new Date();
        } else {
          startDate = new Date();
        }
      }

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + durationDays);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('members')
        .update({ plan: renewPlanId, start_date: startStr, end_date: endStr, status: 'active' })
        .eq('id', renewingMember.id)
        .eq('tenant_id', user.tenantId);
      if (error) throw error;

      const oldPlan = (membershipPlans as any[]).find(p => p.id === renewingMember.plan);
      const planChanged = renewPlanId !== renewingMember.plan;
      let paymentType: 'renewal' | 'upgrade' | 'downgrade' = 'renewal';
      if (planChanged && selectedPlan && oldPlan) {
        paymentType = selectedPlan.price > oldPlan.price ? 'upgrade' : selectedPlan.price < oldPlan.price ? 'downgrade' : 'renewal';
      }

      await supabase.from('payments').insert({
        tenant_id: user.tenantId,
        member_id: renewingMember.id,
        plan_id: selectedPlan?.id || null,
        plan_name: selectedPlan?.name || 'Sin plan',
        amount: selectedPlan?.price || 0,
        payment_date: startStr,
        period_start: startStr,
        period_end: endStr,
        payment_type: paymentType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', user?.tenantId] });
      toast.success('¡Renovación registrada!');
      setRenewingMember(null);
    },
    onError: (e: any) => { if (e.message !== 'sin_licencia') toast.error(e.message || 'Error al renovar'); },
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

    // Si ya hay una fecha de inicio, la respetamos; si no, usamos hoy
    const startDate = editForm.start_date ? new Date(editForm.start_date) : new Date();
    startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setEditForm(prev => ({
      ...prev,
      plan: newPlanId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      // Si la nueva fecha de vencimiento es futura, activar automáticamente
      status: endDate > today ? 'active' : prev.status,
    }));
  };

  // Renueva el plan contando desde hoy
  const handleRenewFromToday = () => {
    if (!editForm.plan) return;
    const selectedPlan = (membershipPlans as any[]).find(p => p.id === editForm.plan);
    const durationDays = selectedPlan?.duration_days || 30;

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + durationDays);

    setEditForm(prev => ({
      ...prev,
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'active',
    }));
  };

  // Extiende el plan sumando la duración desde la fecha de vencimiento actual
  // (si el plan ya venció, extiende desde hoy)
  const handleExtendFromExpiry = () => {
    if (!editForm.plan) return;
    const selectedPlan = (membershipPlans as any[]).find(p => p.id === editForm.plan);
    const durationDays = selectedPlan?.duration_days || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseDate = new Date(today);
    if (editForm.end_date) {
      const currentEnd = new Date(editForm.end_date);
      currentEnd.setMinutes(currentEnd.getMinutes() + currentEnd.getTimezoneOffset());
      currentEnd.setHours(0, 0, 0, 0);
      if (currentEnd > today) baseDate = new Date(currentEnd);
    }

    const endDate = new Date(baseDate);
    endDate.setDate(baseDate.getDate() + durationDays);

    setEditForm(prev => ({
      ...prev,
      start_date: baseDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'active',
    }));
  };

  const handleWhatsApp = () => {
    if (!generatedQRMember) return;
    const portalUrl = `${window.location.origin}/portal/${generatedQRMember.id}`;
    const nombre = generatedQRMember.name.split(" ")[0];
    const text = `¡Hola ${nombre}! 🎉 Bienvenido a tu nuevo gimnasio. 💪\n\nAquí tienes tu Portal de Miembro, donde podrás ver el estado de tu cuenta, vigencia de tu plan y descargar tu Pase Digital:\n👉 ${portalUrl}\n\n¡A entrenar duro! 🔥`;
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

  const getDaysUntilExpiry = (end_date: string | null): number | null => {
    if (!end_date) return null;
    const end = new Date(end_date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredMembers = members.filter((m: any) => {
    const matchSearch =
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    if (filterStatus === 'all') return true;
    const days = getDaysUntilExpiry(m.end_date);
    if (filterStatus === 'expired') return days !== null && days < 0;
    if (filterStatus === 'expiring') return days !== null && days >= 0 && days <= 5;
    if (filterStatus === 'active') return days === null || days > 5;
    return true;
  });

  const expiredCount = (members as any[]).filter(m => {
    const days = getDaysUntilExpiry(m.end_date);
    return days !== null && days < 0;
  }).length;
  const expiringCount = (members as any[]).filter(m => {
    const days = getDaysUntilExpiry(m.end_date);
    return days !== null && days >= 0 && days <= 5;
  }).length;

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
    <>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground line-clamp-1">Directorio de Miembros</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Cargando..." : `Gestiona tus ${members.length} miembros registrados y visualiza sus pases de acceso.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => {
                  if (requireSubscription()) {
                    setIsNewMemberOpen(true);
                  }
                }}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6 py-6 shadow-lg shadow-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="h-5 w-5" />
                <span>Nuevo</span>
              </Button>

              <Button onClick={() => { if (requireSubscription()) setIsImportModalOpen(true); }} variant="outline" className="flex-1 sm:flex-none border-border/40 bg-card hover:bg-secondary/50 text-foreground rounded-2xl px-5 py-6 flex items-center gap-2 transition-all"> <FileUp className="h-5 w-5 text-blue-500" /> <span>Importar</span> </Button>

              <Button
                onClick={handleExportExcel}
                variant="outline"
                className="flex-1 sm:flex-none border-border/40 bg-card hover:bg-secondary/50 text-foreground rounded-2xl px-5 py-6 flex items-center gap-2 transition-all"
              >
                <FileDown className="h-5 w-5 text-emerald-500" />
                <span>Exportar</span>
              </Button>
            </div>

            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                type="text"
                placeholder="Buscar por nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-card border-border/50 text-foreground focus:border-primary/50 transition-colors rounded-2xl"
              />
            </div>
          </div>
        </div>

        {/* Filtros de estado */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all', label: 'Todos', count: members.length },
            { key: 'active', label: 'Activos', count: (members as any[]).length - expiredCount - expiringCount },
            { key: 'expiring', label: 'Por Vencer', count: expiringCount, warn: true },
            { key: 'expired', label: 'Vencidos', count: expiredCount, danger: true },
          ] as const).map(({ key, label, count, warn, danger }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                filterStatus === key
                  ? danger
                    ? "bg-red-500/15 text-red-400 border-red-400/30"
                    : warn
                    ? "bg-amber-500/15 text-amber-400 border-amber-400/30"
                    : "bg-primary/10 text-primary border-primary/30"
                  : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70"
              )}
            >
              {label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                filterStatus === key
                  ? danger ? "bg-red-400/20" : warn ? "bg-amber-400/20" : "bg-primary/20"
                  : "bg-secondary"
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Lista de Miembros */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm ring-1 ring-border/20">
          <div>
            {/* Cabecera de Grid - Solo Desktop */}
            <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1.7fr_1fr_1fr_210px] bg-secondary/40 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-6 py-4">Miembro</div>
              <div className="px-6 py-4">Plan</div>
              <div className="px-6 py-4">Estado</div>
              <div className="px-6 py-4">Última Visita</div>
              <div className="px-6 py-4">Racha</div>
              <div className="px-6 py-4 text-right"></div>
            </div>

            <div className="divide-y divide-border/30">
              {isLoading ? (
                <div className="px-6 py-12 text-center text-muted-foreground">
                  Cargando base de datos...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="px-6 py-12 text-center text-muted-foreground">
                  No hay miembros registrados todavía. Haz clic en "Nuevo Miembro" para comenzar.
                </div>
              ) : (
                filteredMembers.map((member, i) => {
                  const days = getDaysUntilExpiry(member.end_date);
                  const isExpired = days !== null && days < 0;
                  const isExpiring = days !== null && days >= 0 && days <= 5;

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
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className={cn(
                        "flex flex-col md:grid md:grid-cols-[2.5fr_1.5fr_1.7fr_1fr_1fr_210px] md:items-center relative hover:bg-secondary/20 transition-colors group cursor-pointer border-l-2",
                        isExpired
                          ? "border-l-red-400/60 bg-red-500/[0.03]"
                          : isExpiring
                          ? "border-l-amber-400/60 bg-amber-500/[0.03]"
                          : "border-l-transparent"
                      )}
                    >
                      {/* Miembro */}
                      <div className="px-4 py-3 md:px-6 md:py-4 flex flex-row items-center justify-between md:justify-start gap-4">
                        <div className="flex items-center gap-3 md:gap-4 w-full overflow-hidden">
                          {member.photo_url ? (
                            <img
                              src={member.photo_url}
                              alt={member.full_name}
                              className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-border/50"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-sm">
                              {initials}
                            </div>
                          )}
                          <div className="flex flex-col overflow-hidden w-full max-w-[80vw] md:max-w-none">
                            <span className="font-medium text-foreground truncate max-w-full">{member.full_name}</span>
                            <span className="text-[11px] text-muted-foreground truncate max-w-full">{member.email || member.phone || 'Sin contacto'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Flex grid en móvil para métricas */}
                      <div className="px-4 pb-3 md:p-0 flex md:contents flex-row flex-wrap gap-2 md:gap-0">
                        {/* Plan */}
                        <div className="md:px-6 md:py-4 flex-1 md:flex-none">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-semibold max-w-[150px] truncate"
                            style={{ backgroundColor: planColor + '20', color: planColor }}
                          >
                            <Tag className="h-3 w-3 shrink-0" />
                            <span className="truncate">{planName}</span>
                          </span>
                        </div>

                        {/* Estado */}
                        <div className="md:px-6 md:py-4 flex flex-col md:items-start items-end flex-shrink-0 gap-1">
                          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", st.className)}>
                            {st.label}
                          </span>
                          {days !== null && (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              isExpired
                                ? "text-red-400 bg-red-400/10"
                                : isExpiring
                                ? "text-amber-400 bg-amber-400/10"
                                : "text-muted-foreground"
                            )}>
                              <Clock className="h-2.5 w-2.5" />
                              {isExpired
                                ? `Venció hace ${Math.abs(days)}d`
                                : days === 0
                                ? "Vence hoy"
                                : `Vence en ${days}d`
                              }
                            </span>
                          )}
                        </div>

                        {/* Última Visita & Racha juntas en celular, separadas en tablet/PC */}
                        <div className="w-full md:w-auto md:contents flex flex-row justify-between pt-2 md:pt-0 border-t border-border/10 md:border-0 mt-1 md:mt-0">
                          <div className="md:px-6 md:py-4 text-xs md:text-sm text-muted-foreground mt-1 md:mt-0">
                            <span className="md:hidden text-[10px] uppercase font-semibold text-muted-foreground/60 mr-2">Visita:</span>
                            {member.last_visit
                              ? format(new Date(member.last_visit), "dd MMM yyyy", { locale: es })
                              : <span className="text-muted-foreground/40 italic">Sin visitas</span>
                            }
                          </div>

                          <div className="md:px-6 md:py-4 mt-1 md:mt-0 flex items-center">
                            <span className="md:hidden text-[10px] uppercase font-semibold text-muted-foreground/60 mr-2">Racha:</span>
                            {member.streak > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs md:text-sm">
                                <Flame className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                {member.streak}d
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs md:text-sm">—</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="absolute top-3 right-3 md:relative md:top-0 md:right-0 md:px-4 md:py-4 flex items-center justify-end gap-1">
                        {/* Botón Renovar — siempre visible para vencidos/por vencer */}
                        {(isExpired || isExpiring) && (
                          <Button
                            size="sm"
                            className={cn(
                              "h-8 px-3 text-[11px] font-bold gap-1.5 rounded-lg shrink-0",
                              isExpired
                                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-400/30"
                                : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-400/30"
                            )}
                            onClick={(e) => { e.stopPropagation(); setRenewingMember(member); }}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Renovar
                          </Button>
                        )}

                        {/* Resto de acciones — visibles en hover en desktop */}
                        <div className={cn("flex items-center gap-1", !isExpired && !isExpiring && "md:opacity-0 group-hover:opacity-100 transition-opacity")}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary md:bg-transparent bg-secondary/80 backdrop-blur-md"
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
                            size="icon"
                            className="h-8 w-8 text-muted-foreground md:hover:text-primary md:bg-transparent bg-secondary/80 backdrop-blur-md"
                            title="Editar"
                            onClick={(e) => { e.stopPropagation(); openEdit(member); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-[#25D366] hover:bg-[#25D366]/10 md:bg-transparent bg-secondary/80 backdrop-blur-md inline-flex"
                            title="Enviar Enlace por WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              const portalUrl = `${window.location.origin}/portal/${member.id}`;
                              const nombre = member.full_name.split(" ")[0];
                              const text = `¡Hola ${nombre}! 🎉 Bienvenido a tu nuevo gimnasio. 💪\n\nAquí tienes tu Portal de Miembro, donde podrás ver el estado de tu cuenta, vigencia de tu plan y descargar tu Pase Digital:\n👉 ${portalUrl}\n\n¡A entrenar duro! 🔥`;
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
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 md:bg-transparent bg-secondary/80 backdrop-blur-md inline-flex"
                            title="Eliminar"
                            onClick={(e) => { e.stopPropagation(); setDeletingMember(member); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Crear Nuevo Miembro */}
      <Dialog open={isNewMemberOpen} onOpenChange={setIsNewMemberOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl max-h-[96vh] flex flex-col">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/10 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Registrar Miembro
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5 opacity-50">
                Pase Digital Kallpa
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="flex gap-4 items-start">
              <MemberPhotoCapture onPhotoCaptured={setPhotoFile} className="shrink-0" />
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Nombre Completo <span className="text-coral">*</span></Label>
                  <Input
                    id="fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="bg-secondary/30 h-11"
                  />
                </div>
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Teléfono / WhatsApp</label>
                <Input
                  placeholder="+51..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-secondary/20 border-border/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Email <span className="text-[10px] font-medium opacity-50 capitalize">(Opcional)</span>
                </label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/20 border-border/50 h-11"
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-secondary/10 border-t border-border/50 flex flex-col md:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setIsNewMemberOpen(false)}
              className="flex-1 h-12 rounded-xl font-bold order-2 md:order-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createMember.mutate()}
              disabled={createMember.isPending || !fullName}
              className="flex-[2] h-12 bg-volt text-black hover:bg-volt/90 rounded-xl font-bold glow-volt order-1 md:order-2"
            >
              {createMember.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar y Crear Pase"}
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
        <DialogContent className="sm:max-w-md p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl max-h-[96vh] flex flex-col">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/10 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Editar Miembro
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5 opacity-50">Actualizar registro</p>
            </div>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="flex gap-4 items-start border-b border-border/10">
              <MemberPhotoCapture
                onPhotoCaptured={setPhotoFile}
                existingPhotoUrl={editingMember?.photo_url}
                className="shrink-0"
              />
              <div className="flex-1 w-full space-y-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="bg-secondary/20 h-11" />
                </div>
              </div>
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

              {/* Acciones rápidas de renovación */}
              {editForm.plan && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRenewFromToday}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-95"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Renovar desde hoy
                  </button>
                  <button
                    type="button"
                    onClick={handleExtendFromExpiry}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground active:scale-95"
                    title={
                      editForm.end_date && new Date(editForm.end_date) > new Date()
                        ? `Suma desde ${format(new Date(editForm.end_date + 'T00:00:00'), "d MMM", { locale: es })}`
                        : 'Extiende desde hoy (ya venció)'
                    }
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Extender plan
                  </button>
                </div>
              )}
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
                  const selectedPlan = (membershipPlans as any[]).find(p => p.id === editForm.plan);
                  const durationDays = selectedPlan?.duration_days || 30;

                  const startDate = new Date(newStartDate);
                  startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

                  const endDate = new Date(startDate);
                  endDate.setDate(startDate.getDate() + durationDays);

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  setEditForm({
                    ...editForm,
                    start_date: newStartDate,
                    end_date: endDate.toISOString().split('T')[0],
                    status: endDate > today ? 'active' : editForm.status,
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
      {/* Modal: Renovación Rápida */}
      <Dialog open={!!renewingMember} onOpenChange={(open) => !open && setRenewingMember(null)}>
        <DialogContent className="sm:max-w-[420px] p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
          {(() => {
            if (!renewingMember) return null;
            const selectedPlan = (membershipPlans as any[]).find(p => p.id === renewPlanId);
            const durationDays = selectedPlan?.duration_days || 30;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            let previewStart: Date;
            if (renewMode === 'today') {
              previewStart = new Date();
            } else {
              if (renewingMember.end_date) {
                const currentEnd = new Date(renewingMember.end_date + 'T00:00:00');
                previewStart = currentEnd > today ? new Date(currentEnd) : new Date();
              } else {
                previewStart = new Date();
              }
            }
            const previewEnd = new Date(previewStart);
            previewEnd.setDate(previewStart.getDate() + durationDays);
            const daysUntil = getDaysUntilExpiry(renewingMember.end_date);
            const memberIsExpired = daysUntil !== null && daysUntil < 0;

            return (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-border/50 bg-secondary/10">
                  <div className="flex items-center gap-3">
                    {renewingMember.photo_url ? (
                      <img src={renewingMember.photo_url} alt={renewingMember.full_name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/50" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {renewingMember.full_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-bold text-foreground">{renewingMember.full_name}</h2>
                      <span className={cn(
                        "text-[10px] font-semibold",
                        memberIsExpired ? "text-red-400" : "text-amber-400"
                      )}>
                        {memberIsExpired
                          ? `Venció hace ${Math.abs(daysUntil!)} días`
                          : daysUntil === 0 ? "Vence hoy" : `Vence en ${daysUntil} días`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Plan selector */}
                  <div className="space-y-2">
                    <Label>Plan a Renovar</Label>
                    <Select value={renewPlanId} onValueChange={setRenewPlanId}>
                      <SelectTrigger className="w-full bg-secondary/30 h-11 border-border/50">
                        <SelectValue placeholder="Selecciona un plan" />
                      </SelectTrigger>
                      <SelectContent className="border-border/50 bg-card rounded-xl shadow-xl">
                        {(membershipPlans as any[]).map((p: any) => (
                          <SelectItem key={p.id} value={p.id} className="cursor-pointer py-3 focus:bg-secondary/40">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color || '#6b7280' }} />
                              <span className="font-semibold text-sm">{p.name}</span>
                              <span className="text-muted-foreground text-xs bg-secondary px-1.5 py-0.5 rounded-md">
                                S/{p.price} / {p.duration_days}d
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Modo de renovación */}
                  <div className="space-y-2">
                    <Label>Inicio de la nueva vigencia</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRenewMode('today')}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                          renewMode === 'today'
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <RefreshCw className="h-3 w-3" />
                          Desde hoy
                        </div>
                        <span className="text-[10px] opacity-70">Reinicia la vigencia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenewMode('extend')}
                        disabled={!renewingMember.end_date || memberIsExpired}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                          renewMode === 'extend'
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/60",
                          (!renewingMember.end_date || memberIsExpired) && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <CalendarPlus className="h-3 w-3" />
                          Extender
                        </div>
                        <span className="text-[10px] opacity-70">Suma desde vencimiento</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview de fechas */}
                  <div className="rounded-xl bg-secondary/40 border border-border/30 p-4 flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Inicio</p>
                      <p className="text-sm font-bold text-foreground">{format(previewStart, "d MMM yyyy", { locale: es })}</p>
                    </div>
                    <div className="text-muted-foreground/40 text-xs font-bold">→</div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Vence</p>
                      <p className="text-sm font-bold text-foreground">{format(previewEnd, "d MMM yyyy", { locale: es })}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Precio</p>
                      <p className="text-sm font-bold text-primary">S/ {selectedPlan?.price || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setRenewingMember(null)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-[2] h-11 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-bold glow-volt gap-2"
                    disabled={quickRenewMember.isPending || !renewPlanId}
                    onClick={() => quickRenewMember.mutate()}
                  >
                    {quickRenewMember.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Renovando...</>
                      : <><RotateCcw className="h-4 w-4" /> Confirmar Renovación</>
                    }
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal: Importar Miembros */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        if (!isImporting) {
          setIsImportModalOpen(open);
          if (!open) setImportFile(null);
        }
      }}>
        <DialogContent className="sm:max-w-md border-border/50 bg-card rounded-3xl shadow-2xl overflow-hidden p-0">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/10 shrink-0">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileUp className="h-5 w-5 text-blue-500" />
              Importar Miembros (Excel)
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1">Sube un archivo .xlsx para registrar múltiples usuarios.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border/50 rounded-2xl p-8 hover:bg-secondary/50 transition-colors cursor-pointer text-center group"
                onClick={() => document.getElementById('excel-upload')?.click()}
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FileUp className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Haz clic para seleccionar un archivo</h3>
                <p className="text-xs text-muted-foreground">Solo archivos de Excel (.xlsx)</p>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportFile(file);
                  }}
                />
              </div>

              {importFile && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-400 truncate max-w-[200px]">{importFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 hover:bg-red-500/10 hover:text-red-400 text-muted-foreground transition-colors"
                    onClick={() => setImportFile(null)}
                    disabled={isImporting}
                  >
                    Quitar
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-secondary/30 rounded-xl p-4 space-y-2 border border-border/30">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Importante
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                <li>• Asegúrate de usar el formato correcto.</li>
                <li>• Campos obligatorios: Nombre Completo.</li>
                <li>• El 'Plan' debe coincidir con los nombres definidos en tus <span className="text-primary font-medium">Planes Pro</span>. Si se deja en blanco asumirá duración 30 días.</li>
              </ul>
              <Button
                variant="link"
                className="text-xs text-blue-400 hover:text-blue-300 h-auto p-0 mt-2"
                onClick={handleDownloadTemplate}
              >
                Descargar plantilla de Excel
              </Button>
            </div>
          </div>

          <div className="p-6 bg-secondary/10 border-t border-border/50 flex flex-col md:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}
              className="flex-1 h-12 rounded-xl"
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={processImportFile}
              disabled={!importFile || isImporting}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 glow-volt transition-colors relative"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                "Procesar Archivo"
              )}
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
          photo_url: cardMember.photo_url
        } as any : null}
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

    </>

  );
};

export default Members;


import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, Users, Clock, Pencil, Trash2,
  ToggleLeft, ToggleRight, CalendarDays, User, X, ListVideo, CheckCircle2,
  CalendarCheck2, Phone,
} from "lucide-react";

const PRESET_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#65A30D",
];

/** Lunes→Domingo en el grid; day_of_week usa convención JS (0=Dom, 1=Lun ... 6=Sáb) */
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_OF_WEEK = [1, 2, 3, 4, 5, 6, 0];

type GymClass = {
  id: string;
  name: string;
  description: string | null;
  instructor: string | null;
  capacity: number;
  duration_minutes: number;
  color: string;
  is_active: boolean;
};

type ClassSchedule = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  is_active: boolean;
  classes: GymClass;
};

/**
 * Reserva individual de un miembro para una sesión concreta.
 * `class_schedules` puede ser null si el slot fue eliminado del horario.
 */
type ClassReservation = {
  id: string;
  member_id: string;
  schedule_id: string;
  session_date: string;
  status: string;
  members: { full_name: string; phone: string | null } | null;
  class_schedules: {
    start_time: string;
    classes: { name: string; color: string; capacity: number } | null;
  } | null;
};

const defaultClassForm = {
  name: "",
  description: "",
  instructor: "",
  capacity: "20",
  duration_minutes: "60",
  color: "#7C3AED",
};

/**
 * Página de gestión de clases y horario semanal.
 *
 * Tab "Mis Clases": CRUD de plantillas de clase (nombre, instructor, capacidad, duración, color).
 * Tab "Horario Semanal": Grid 7 columnas (Lun-Dom). Cada columna muestra los slots
 * programados para ese día; el botón "agregar" abre un modal para elegir clase + hora.
 * Pasar el cursor sobre un slot muestra el botón "×" para eliminarlo del horario.
 */
const Classes = () => {
  const { user } = useAuth();
  const { requireSubscription } = useSubscription();
  const queryClient = useQueryClient();

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<GymClass | null>(null);
  const [classForm, setClassForm] = useState(defaultClassForm);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [scheduleForm, setScheduleForm] = useState({ class_id: "", start_time: "07:00" });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: classes = [], isLoading: loadingClasses } = useQuery<GymClass[]>({
    queryKey: ["gym_classes", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("tenant_id", user.tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenantId,
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<ClassSchedule[]>({
    queryKey: ["class_schedules", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from("class_schedules")
        .select("*, classes(*)")
        .eq("tenant_id", user.tenantId)
        .eq("is_active", true)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenantId,
  });

  /**
   * Reservas confirmadas desde hoy en adelante.
   * Trae el nombre del miembro y los datos del slot (clase + hora) para agruparlos
   * en la vista de admin sin necesidad de joins adicionales.
   */
  const { data: reservations = [], isLoading: loadingReservations } = useQuery<ClassReservation[]>({
    queryKey: ["class_reservations_admin", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("class_reservations")
        .select("*, members(full_name, phone), class_schedules(start_time, classes(name, color, capacity))")
        .eq("tenant_id", user.tenantId)
        .eq("status", "confirmed")
        .gte("session_date", today)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenantId,
  });

  // ── Class mutations ──────────────────────────────────────────────────────────

  /** Crea o actualiza una clase. Valida nombre y requiere suscripción activa. */
  const saveClass = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error("sin_licencia");
      if (!user?.tenantId) throw new Error("Sin tenant");
      if (!classForm.name.trim()) throw new Error("El nombre es requerido");
      const payload = {
        name: classForm.name.trim(),
        description: classForm.description.trim() || null,
        instructor: classForm.instructor.trim() || null,
        capacity: parseInt(classForm.capacity) || 20,
        duration_minutes: parseInt(classForm.duration_minutes) || 60,
        color: classForm.color,
        tenant_id: user.tenantId,
      };
      if (editingClass) {
        const { error } = await supabase.from("classes").update(payload)
          .eq("id", editingClass.id).eq("tenant_id", user.tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym_classes"] });
      queryClient.invalidateQueries({ queryKey: ["class_schedules"] });
      toast.success(editingClass ? "Clase actualizada" : "Clase creada");
      setIsClassModalOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /** Activa o desactiva una clase. Las clases inactivas no aparecen en el horario ni en el portal. */
  const toggleClass = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!user?.tenantId) throw new Error("Sin tenant");
      const { error } = await supabase.from("classes")
        .update({ is_active: !is_active })
        .eq("id", id).eq("tenant_id", user.tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym_classes"] });
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  /** Elimina una clase y en cascada todos sus slots de horario y reservas. */
  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("Sin tenant");
      const { error } = await supabase.from("classes")
        .delete().eq("id", id).eq("tenant_id", user.tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym_classes"] });
      queryClient.invalidateQueries({ queryKey: ["class_schedules"] });
      toast.success("Clase eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Schedule mutations ───────────────────────────────────────────────────────

  /** Agrega un slot de clase en el día y hora seleccionados del horario semanal. */
  const addSchedule = useMutation({
    mutationFn: async () => {
      if (!requireSubscription()) throw new Error("sin_licencia");
      if (!user?.tenantId) throw new Error("Sin tenant");
      if (!scheduleForm.class_id) throw new Error("Selecciona una clase");
      const { error } = await supabase.from("class_schedules").insert({
        tenant_id: user.tenantId,
        class_id: scheduleForm.class_id,
        day_of_week: DAY_OF_WEEK[selectedDayIndex],
        start_time: scheduleForm.start_time,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_schedules"] });
      toast.success("Clase agregada al horario");
      setIsScheduleModalOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /** Elimina un slot del horario semanal (no elimina la clase, solo ese horario). */
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("Sin tenant");
      const { error } = await supabase.from("class_schedules")
        .delete().eq("id", id).eq("tenant_id", user.tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_schedules"] });
      toast.success("Slot eliminado del horario");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const openCreateClass = () => {
    setEditingClass(null);
    setClassForm(defaultClassForm);
    setIsClassModalOpen(true);
  };

  const openEditClass = (cls: GymClass) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      description: cls.description || "",
      instructor: cls.instructor || "",
      capacity: String(cls.capacity),
      duration_minutes: String(cls.duration_minutes),
      color: cls.color,
    });
    setIsClassModalOpen(true);
  };

  const openAddSchedule = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    setScheduleForm({ class_id: activeClasses[0]?.id || "", start_time: "07:00" });
    setIsScheduleModalOpen(true);
  };

  const activeClasses = classes.filter((c) => c.is_active);
  const inactiveClasses = classes.filter((c) => !c.is_active);

  // Agrupa los slots del horario por día de la semana (índice = posición en DAYS)
  const schedulesByDay = DAY_OF_WEEK.map((dow) =>
    schedules
      .filter((s) => s.day_of_week === dow)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  );

  /**
   * Agrupa las reservas confirmadas por sesión (date + schedule_id).
   * Cada entrada del array representa una sesión concreta con la lista de miembros inscritos.
   * Ordenadas primero por fecha, luego por hora de inicio.
   */
  const reservationsBySession = useMemo(() => {
    const map = new Map<string, {
      key: string;
      date: string;
      schedule: ClassReservation["class_schedules"];
      reservations: ClassReservation[];
    }>();
    reservations.forEach((r) => {
      const key = `${r.session_date}_${r.schedule_id}`;
      if (!map.has(key)) {
        map.set(key, { key, date: r.session_date, schedule: r.class_schedules, reservations: [] });
      }
      map.get(key)!.reservations.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return (a.schedule?.start_time || "").localeCompare(b.schedule?.start_time || "");
    });
  }, [reservations]);

  /** Formatea una fecha ISO (YYYY-MM-DD) en español, ej. "lunes 14 de abril" */
  const formatSessionDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long",
    });
  };

  return (
    <>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between sm:items-end gap-3"
        >
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-tight">
              Clases y Horario
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {loadingClasses
                ? "Cargando..."
                : `${activeClasses.length} clases activas · ${schedules.length} slots en el horario`}
            </p>
          </div>
          <Button
            onClick={() => { if (requireSubscription()) openCreateClass(); }}
            className="bg-primary text-primary-foreground hover:opacity-90 shadow-lg glow-volt gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Nueva Clase
          </Button>
        </motion.div>

        <Tabs defaultValue="clases" className="space-y-6">
          <TabsList className="bg-secondary/40 p-1 border border-border/50 rounded-xl w-full sm:w-auto h-auto">
            <TabsTrigger value="clases" className="rounded-lg py-2 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <ListVideo className="h-3.5 w-3.5 mr-2" /> Mis Clases
            </TabsTrigger>
            <TabsTrigger value="horario" className="rounded-lg py-2 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <CalendarDays className="h-3.5 w-3.5 mr-2" /> Horario Semanal
            </TabsTrigger>
            <TabsTrigger value="reservas" className="rounded-lg py-2 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <CalendarCheck2 className="h-3.5 w-3.5 mr-2" /> Reservas
              {reservations.length > 0 && (
                <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {reservations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: MIS CLASES ── */}
          <TabsContent value="clases" className="focus-visible:outline-none space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {!loadingClasses && classes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border/50 rounded-2xl bg-card/30 gap-4">
                  <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20">
                    <ListVideo className="h-10 w-10 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">Sin clases creadas</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Crea tus clases y luego arma tu horario semanal en el tab "Horario".
                    </p>
                  </div>
                  <Button
                    onClick={() => { if (requireSubscription()) openCreateClass(); }}
                    className="bg-primary text-primary-foreground gap-2"
                  >
                    <Plus className="h-4 w-4" /> Crear primera clase
                  </Button>
                </div>
              )}

              {activeClasses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                    Activas
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {activeClasses.map((cls) => (
                        <ClassCard
                          key={cls.id}
                          cls={cls}
                          onEdit={() => openEditClass(cls)}
                          onToggle={() => toggleClass.mutate({ id: cls.id, is_active: cls.is_active })}
                          onDelete={() => deleteClass.mutate(cls.id)}
                          isLoading={toggleClass.isPending || deleteClass.isPending}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {inactiveClasses.length > 0 && (
                <div className="opacity-60">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                    Desactivadas
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {inactiveClasses.map((cls) => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        onEdit={() => openEditClass(cls)}
                        onToggle={() => toggleClass.mutate({ id: cls.id, is_active: cls.is_active })}
                        onDelete={() => deleteClass.mutate(cls.id)}
                        isLoading={toggleClass.isPending || deleteClass.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── TAB: HORARIO SEMANAL ── */}
          <TabsContent value="horario" className="focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {activeClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border/50 rounded-2xl bg-card/30 gap-3">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Primero crea al menos una clase activa para armar el horario.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto pb-4">
                  <div className="grid grid-cols-7 gap-2 min-w-[640px]">
                    {DAYS.map((day, idx) => (
                      <div key={day} className="flex flex-col gap-2">
                        {/* Cabecera del día */}
                        <div className="text-center py-2 rounded-xl bg-secondary/40 border border-border/40">
                          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            {day.slice(0, 3)}
                          </p>
                        </div>

                        {/* Slots del día */}
                        <div className="flex flex-col gap-1.5 min-h-[60px]">
                          {loadingSchedules ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                            </div>
                          ) : (
                            <AnimatePresence>
                              {schedulesByDay[idx].map((slot) => (
                                <motion.div
                                  key={slot.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  className="group relative rounded-xl p-2 border overflow-hidden"
                                  style={{
                                    backgroundColor: (slot.classes?.color || "#7C3AED") + "20",
                                    borderColor: (slot.classes?.color || "#7C3AED") + "40",
                                  }}
                                >
                                  <button
                                    onClick={() => deleteSchedule.mutate(slot.id)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-4 w-4 rounded-full bg-black/50 flex items-center justify-center transition-opacity"
                                  >
                                    <X className="h-2.5 w-2.5 text-white" />
                                  </button>
                                  <p className="text-[9px] font-black text-white/50 tracking-wider">
                                    {slot.start_time.slice(0, 5)}
                                  </p>
                                  <p
                                    className="text-[11px] font-bold leading-tight truncate pr-4"
                                    style={{ color: slot.classes?.color || "#7C3AED" }}
                                  >
                                    {slot.classes?.name}
                                  </p>
                                  {slot.classes?.instructor && (
                                    <p className="text-[9px] text-white/40 truncate mt-0.5">
                                      {slot.classes.instructor}
                                    </p>
                                  )}
                                  <p className="text-[9px] text-white/30 mt-0.5 flex items-center gap-0.5">
                                    <Users className="h-2.5 w-2.5" />
                                    {slot.classes?.capacity}
                                  </p>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          )}
                        </div>

                        {/* Botón agregar slot */}
                        <button
                          onClick={() => openAddSchedule(idx)}
                          className="w-full py-2 rounded-xl border border-dashed border-border/40 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-all text-[10px] font-bold flex items-center justify-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> agregar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>
          {/* ── TAB: RESERVAS ── */}
          <TabsContent value="reservas" className="focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {loadingReservations ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : reservationsBySession.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border/50 rounded-2xl bg-card/30 gap-4">
                  <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20">
                    <CalendarCheck2 className="h-10 w-10 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">Sin reservas próximas</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Cuando tus miembros reserven clases desde su portal, aparecerán aquí.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Agrupa sesiones por fecha para renderizar una sección por día */}
                  {Array.from(new Set(reservationsBySession.map((s) => s.date))).map((date) => {
                    const sessionsOfDay = reservationsBySession.filter((s) => s.date === date);
                    return (
                      <div key={date}>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-3 capitalize">
                          {formatSessionDate(date)}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {sessionsOfDay.map((session) => {
                            const cls = session.schedule?.classes;
                            const capacity = cls?.capacity ?? 0;
                            const count = session.reservations.length;
                            const pct = capacity > 0 ? Math.min((count / capacity) * 100, 100) : 0;
                            return (
                              <div
                                key={session.key}
                                className="rounded-2xl border border-border/50 bg-card/50 shadow-sm overflow-hidden"
                              >
                                {/* Barra de color de la clase */}
                                <div
                                  className="h-1.5 w-full"
                                  style={{ backgroundColor: cls?.color || "#7C3AED" }}
                                />
                                <div className="p-4 space-y-3">
                                  {/* Nombre y hora */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">
                                        {cls?.name || "Clase eliminada"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {session.schedule?.start_time?.slice(0, 5) || "--:--"}
                                      </p>
                                    </div>
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                                      style={{
                                        color: cls?.color || "#7C3AED",
                                        borderColor: (cls?.color || "#7C3AED") + "40",
                                        backgroundColor: (cls?.color || "#7C3AED") + "15",
                                      }}
                                    >
                                      {count}/{capacity} cupos
                                    </span>
                                  </div>

                                  {/* Barra de ocupación */}
                                  <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${pct}%`,
                                        backgroundColor: cls?.color || "#7C3AED",
                                      }}
                                    />
                                  </div>

                                  {/* Lista de miembros */}
                                  <div className="space-y-1.5 pt-1 border-t border-border/30">
                                    {session.reservations.map((r) => (
                                      <div key={r.id} className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-full bg-secondary/60 flex items-center justify-center shrink-0">
                                          <User className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-foreground flex-1 truncate">
                                          {r.members?.full_name || "Miembro desconocido"}
                                        </p>
                                        {r.members?.phone && (
                                          <a
                                            href={`https://wa.me/${r.members.phone.replace(/\D/g, "")}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#25D366] hover:opacity-80 transition-opacity shrink-0"
                                            title="Contactar por WhatsApp"
                                          >
                                            <Phone className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MODAL: CREAR / EDITAR CLASE ── */}
      <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
        <DialogContent className="sm:max-w-md p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/20">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <ListVideo className="h-5 w-5 text-primary" />
              {editingClass ? "Editar Clase" : "Nueva Clase"}
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nombre <span className="text-coral">*</span></Label>
              <Input
                placeholder="Ej. CrossFit Matutino"
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="bg-secondary/30"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Ej. Alta intensidad funcional"
                value={classForm.description}
                onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                className="bg-secondary/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Instructor
              </Label>
              <Input
                placeholder="Ej. Carlos Pérez"
                value={classForm.instructor}
                onChange={(e) => setClassForm({ ...classForm, instructor: e.target.value })}
                className="bg-secondary/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Capacidad
                </Label>
                <Input
                  type="number" min="1"
                  value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                  className="bg-secondary/30 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Duración (min)
                </Label>
                <Input
                  type="number" min="15" step="15"
                  value={classForm.duration_minutes}
                  onChange={(e) => setClassForm({ ...classForm, duration_minutes: e.target.value })}
                  className="bg-secondary/30 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setClassForm({ ...classForm, color: c })}
                    className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: classForm.color === c ? "white" : "transparent",
                      boxShadow: classForm.color === c ? `0 0 0 2px ${c}` : "none",
                    }}
                  >
                    {classForm.color === c && (
                      <CheckCircle2 className="h-4 w-4 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              className="p-4 rounded-xl border flex items-center justify-between gap-2"
              style={{ borderColor: classForm.color + "50", background: classForm.color + "15" }}
            >
              <div className="overflow-hidden">
                <p className="font-semibold text-foreground truncate">{classForm.name || "Nombre de la clase"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {classForm.instructor || "Sin instructor"} · {classForm.duration_minutes || 60}min · {classForm.capacity || 20} cupos
                </p>
              </div>
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: classForm.color }} />
            </div>
          </div>
          <div className="p-6 pt-0 flex gap-3">
            <Button variant="outline" className="w-full bg-transparent border-border hover:bg-secondary"
              onClick={() => setIsClassModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full bg-primary text-primary-foreground hover:opacity-90 glow-volt shadow-lg"
              disabled={saveClass.isPending || !classForm.name}
              onClick={() => saveClass.mutate()}
            >
              {saveClass.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</>
                : editingClass ? "Guardar Cambios" : "Crear Clase"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: AGREGAR SLOT AL HORARIO ── */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-sm p-0 border-border/50 bg-card rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-border/50 bg-secondary/20">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Agregar al Horario — <span className="text-primary">{DAYS[selectedDayIndex]}</span>
            </DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Clase</Label>
              <select
                value={scheduleForm.class_id}
                onChange={(e) => setScheduleForm({ ...scheduleForm, class_id: e.target.value })}
                className="w-full rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Selecciona una clase...</option>
                {activeClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}{cls.instructor ? ` — ${cls.instructor}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hora de inicio</Label>
              <Input
                type="time"
                value={scheduleForm.start_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                className="bg-secondary/30 font-mono"
              />
            </div>
          </div>
          <div className="p-6 pt-0 flex gap-3">
            <Button variant="outline" className="w-full bg-transparent border-border hover:bg-secondary"
              onClick={() => setIsScheduleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
              disabled={addSchedule.isPending || !scheduleForm.class_id}
              onClick={() => addSchedule.mutate()}
            >
              {addSchedule.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Agregando...</>
                : "Agregar al Horario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── ClassCard Sub-component ───────────────────────────────────────────────────

const ClassCard = ({
  cls, onEdit, onToggle, onDelete, isLoading,
}: {
  cls: GymClass;
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
    <div className="rounded-2xl border border-border/50 bg-card/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-1.5 w-full" style={{ backgroundColor: cls.color }} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="overflow-hidden flex-1">
            <p className="font-semibold text-sm truncate text-foreground">{cls.name}</p>
            {cls.instructor && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3 shrink-0" /> {cls.instructor}
              </p>
            )}
            {cls.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cls.description}</p>
            )}
          </div>
          <div className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: cls.color }} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {cls.duration_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {cls.capacity} cupos
          </span>
        </div>
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
          <Button size="sm" variant="ghost" onClick={onEdit}
            className="flex-1 h-7 text-[11px] hover:bg-secondary gap-1">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle} disabled={isLoading}
            className="flex-1 h-7 text-[11px] gap-1 hover:bg-secondary">
            {cls.is_active
              ? <><ToggleRight className="h-3.5 w-3.5 text-success" /> Activa</>
              : <><ToggleLeft className="h-3.5 w-3.5" /> Inactiva</>}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={isLoading}
            className="h-7 w-7 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  </motion.div>
);

export default Classes;

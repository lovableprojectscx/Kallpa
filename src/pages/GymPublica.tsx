import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Phone, MessageCircle, Users, Clock, CalendarDays, Tag, ArrowRight, Dumbbell } from "lucide-react";

/**
 * Configuración pública del gym, accedida por slug.
 * El campo `mp_access_token` NO se expone en la consulta de la página pública.
 */
type GymPublicSettings = {
  tenant_id: string;
  gym_name: string | null;
  slug: string | null;
  address: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  social_media: { website?: string; instagram?: string; facebook?: string } | null;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  description: string | null;
  is_active: boolean;
};

type ClassSchedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  classes: {
    name: string;
    instructor: string | null;
    duration_minutes: number;
    capacity: number;
    color: string;
  } | null;
};

/** Días de la semana ordenados Lun-Dom para el grid del horario */
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAY_OF_WEEK = [1, 2, 3, 4, 5, 6, 0];

/**
 * Página pública del gym en `/g/:slug`.
 *
 * No requiere autenticación. Muestra:
 * - Nombre del gym y datos de contacto
 * - Planes activos con precios en soles
 * - Horario semanal de clases (si el gym tiene clases configuradas)
 * - Botón de WhatsApp para contacto directo
 * - Link "Soy miembro" → portal de miembros
 *
 * NOTA: Requiere que `gym_settings` tenga una RLS policy de lectura pública:
 *   CREATE POLICY "Public read gym settings" ON gym_settings FOR SELECT USING (true);
 * Y que `membership_plans` y `class_schedules` también permitan lectura anon para el tenant.
 */
const GymPublica = () => {
  const { slug } = useParams<{ slug: string }>();

  // ── Datos del gym (por slug) ──────────────────────────────────────────────

  const { data: gym, isLoading: loadingGym, isError } = useQuery<GymPublicSettings | null>({
    queryKey: ["gym_public", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("gym_settings")
        .select("tenant_id, gym_name, slug, address, contact_phone, whatsapp_number, social_media")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    retry: 1,
  });

  // ── Planes activos ────────────────────────────────────────────────────────

  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ["gym_public_plans", gym?.tenant_id],
    queryFn: async () => {
      if (!gym?.tenant_id) return [];
      const { data, error } = await supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, description, is_active")
        .eq("tenant_id", gym.tenant_id)
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gym?.tenant_id,
  });

  // ── Horario semanal ───────────────────────────────────────────────────────

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<ClassSchedule[]>({
    queryKey: ["gym_public_schedules", gym?.tenant_id],
    queryFn: async () => {
      if (!gym?.tenant_id) return [];
      const { data, error } = await supabase
        .from("class_schedules")
        .select("id, day_of_week, start_time, classes(name, instructor, duration_minutes, capacity, color)")
        .eq("tenant_id", gym.tenant_id)
        .eq("is_active", true)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gym?.tenant_id,
  });

  // Agrupa slots por día de la semana para el grid
  const schedulesByDay = useMemo(
    () => DAY_OF_WEEK.map((dow) => schedules.filter((s) => s.day_of_week === dow)),
    [schedules]
  );

  const hasClasses = schedules.length > 0;
  const whatsappUrl = gym?.whatsapp_number
    ? `https://wa.me/${gym.whatsapp_number.replace(/\D/g, "")}?text=Hola,%20quiero%20información%20sobre%20el%20gimnasio`
    : null;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loadingGym) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Gym no encontrado ─────────────────────────────────────────────────────

  if (isError || !gym) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 px-4">
        <Dumbbell className="h-16 w-16 text-muted-foreground/30" />
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground">Gym no encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            No existe un gimnasio con la URL "{slug}". Verifica el enlace o pide al gym que comparta
            su link correcto.
          </p>
        </div>
        <Link to="/" className="text-primary text-sm font-medium hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  // ── Página pública ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border/50 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(var(--primary-rgb),0.15),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                  {gym.gym_name || "Gimnasio"}
                </h1>
                {gym.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {gym.address}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20b858] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg"
                >
                  <MessageCircle className="h-4 w-4" />
                  Consultar por WhatsApp
                </a>
              )}
              {gym.contact_phone && !whatsappUrl && (
                <a
                  href={`tel:${gym.contact_phone}`}
                  className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {gym.contact_phone}
                </a>
              )}
              <Link
                to="/portal"
                className="inline-flex items-center gap-2 border border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Soy miembro <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

        {/* Planes */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold text-foreground">Planes de Membresía</h2>
          </div>

          {loadingPlans ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este gym aún no tiene planes publicados.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm space-y-3"
                >
                  <div>
                    <h3 className="font-semibold text-foreground text-base">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-2xl font-display font-bold text-primary">
                        S/ {plan.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {plan.duration_days} días de acceso
                      </p>
                    </div>
                    {whatsappUrl && (
                      <a
                        href={`${whatsappUrl}&text=Hola,%20me%20interesa%20el%20plan%20"${encodeURIComponent(plan.name)}"%20de%20S/%20${plan.price}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Consultar
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Horario de Clases */}
        {(hasClasses || loadingSchedules) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground">Horario de Clases</h2>
            </div>

            {loadingSchedules ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                  {DAYS.map((day, idx) => (
                    <div key={day} className="flex flex-col gap-2">
                      {/* Cabecera del día */}
                      <div className="text-center py-2 rounded-xl bg-secondary/40 border border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {day.slice(0, 3)}
                        </p>
                      </div>
                      {/* Slots del día */}
                      <div className="flex flex-col gap-1.5 min-h-[40px]">
                        {schedulesByDay[idx].length === 0 ? (
                          <div className="flex items-center justify-center py-3">
                            <span className="text-[10px] text-muted-foreground/30">—</span>
                          </div>
                        ) : (
                          schedulesByDay[idx].map((slot) => (
                            <div
                              key={slot.id}
                              className="rounded-xl p-2 border overflow-hidden"
                              style={{
                                backgroundColor: (slot.classes?.color || "#7C3AED") + "20",
                                borderColor: (slot.classes?.color || "#7C3AED") + "40",
                              }}
                            >
                              <p className="text-[9px] font-black text-white/50 tracking-wider">
                                {slot.start_time.slice(0, 5)}
                              </p>
                              <p
                                className="text-[11px] font-bold leading-tight truncate"
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
                                <Clock className="h-2.5 w-2.5 ml-1" />
                                {slot.classes?.duration_minutes}min
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Footer */}
        <footer className="border-t border-border/30 pt-6 pb-4 text-center">
          <p className="text-[11px] text-muted-foreground/50">
            Gestionado con{" "}
            <span className="font-semibold text-muted-foreground">KALLPA</span>
            {" · "}
            <Link to="/portal" className="hover:text-primary transition-colors">
              Acceder como miembro
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default GymPublica;

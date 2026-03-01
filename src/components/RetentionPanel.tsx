import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, MessageSquare, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function RetentionPanel() {
  const { user } = useAuth();

  const { data: atRiskMembers = [], isLoading } = useQuery({
    queryKey: ['retention_risk', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      // Obtenemos todos los miembros activos junto con su ÚLTIMO registro de asistencia
      const { data, error } = await supabase
        .from('members')
        .select(`
          id,
          full_name,
          phone,
          status,
          created_at,
          attendance ( check_in_time )
        `)
        .eq('tenant_id', user.tenantId)
        .eq('status', 'active')
        .order('check_in_time', { foreignTable: 'attendance', ascending: false })
        .limit(1, { foreignTable: 'attendance' });

      if (error) {
        console.error(error);
        return [];
      }

      const today = new Date();

      const processed = data?.map((member: any) => {
        const lastCheckIn = member.attendance?.[0]?.check_in_time;
        // Si no tiene asistencias, calculamos desde su fecha de creación
        const lastDate = lastCheckIn ? new Date(lastCheckIn) : new Date(member.created_at);
        const daysAway = differenceInDays(today, lastDate);

        let lastVisitText = "Nunca ha asistido";
        if (lastCheckIn) {
          lastVisitText = `Hace ${daysAway} días`;
        } else if (daysAway > 0) {
          lastVisitText = `Registrado hace ${daysAway} días`;
        } else {
          lastVisitText = "Registrado hoy";
        }

        return {
          id: member.id,
          name: member.full_name,
          phone: member.phone,
          lastVisit: lastVisitText,
          daysAway,
          avatar: member.full_name.substring(0, 2).toUpperCase(),
        };
      }) || [];

      // Filtramos a los que tienen al menos 7 días sin venir
      return processed.filter(m => m.daysAway >= 7).sort((a, b) => b.daysAway - a.daysAway);
    },
    enabled: !!user?.tenantId
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3 sm:px-5 sm:py-4 bg-coral/5">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <AlertTriangle className="h-4 w-4 text-coral animate-pulse shrink-0" />
          <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
            En Riesgo de Abandono
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </h3>
        </div>
        {!isLoading && (
          <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-[10px] font-bold text-coral">
            {atRiskMembers.length} miembros
          </span>
        )}
      </div>
      <div className="divide-y divide-border/20 max-h-[350px] sm:max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="px-5 py-8 sm:py-12 text-center text-sm text-muted-foreground">
            Calculando métricas de retención...
          </div>
        ) : atRiskMembers.length === 0 ? (
          <div className="px-5 py-8 sm:py-12 text-center flex flex-col items-center gap-2 sm:gap-3">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-success" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-foreground">¡Excelente retención!</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">No hay miembros en riesgo actualmente.</p>
            </div>
          </div>
        ) : (
          atRiskMembers.map((member: any, i: number) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center justify-between px-3 py-3 sm:px-5 sm:py-3.5 transition-smooth hover:bg-secondary/30 gap-2"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
                <div className={cn(
                  "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold shadow-sm",
                  member.daysAway > 14 ? "bg-coral/15 text-coral" : "bg-primary/10 text-primary"
                )}>
                  {member.avatar}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{member.name}</p>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground/60" />
                    <span className={cn("text-[10px] sm:text-[11px] font-medium truncate", member.daysAway > 14 ? "text-coral" : "text-muted-foreground")}>{member.lastVisit}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Hola ${member.name.split(' ')[0]}, notamos que hace ${member.daysAway} días no vienes a entrenar. ¡Te extrañamos en el gimnasio! ¿Cuándo te vemos de vuelta? 💪`);
                  if (member.phone) {
                    window.open(`https://wa.me/${member.phone}?text=${text}`, '_blank');
                  } else {
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-primary transition-smooth hover:bg-primary/20 hover:scale-105 active:scale-95"
              >
                <MessageSquare className="h-3 w-3" />
                <span className="hidden sm:inline">Reenganche</span>
              </button>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

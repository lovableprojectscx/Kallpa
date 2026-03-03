import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, MessageSquare, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function RetentionPanel() {
  const { user } = useAuth();

  const { data: atRiskMembers = [], isLoading } = useQuery({
    queryKey: ['retention_risk', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      const { data, error } = await supabase.rpc('get_retention_risk_members', {
        p_tenant_id: user.tenantId,
        p_days_threshold: 7
      });

      if (error) {
        console.error("RPC Error (Retention Risk):", error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutos de caché para evitar recargas constantes al navegar
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
                  const firstName = member.name.split(' ')[0];
                  // Mensaje diferenciado: nunca asistió vs dejó de asistir
                  const msg = member.neverAttended
                    ? `¡Hola ${firstName}! 🏋️ Vemos que te inscribiste hace ${member.daysAway} días en el gimnasio, pero aún no has podido venir. ¡Tu primera sesión te espera! ¿Cuándo arrancamos? Cualquier duda estoy aquí para ayudarte 💪`
                    : `¡Hola ${firstName}! Notamos que hace ${member.daysAway} días no vienes a entrenar. ¡Te extrañamos en el gimnasio! ¿Cuándo te vemos de vuelta? 💪`;
                  const encoded = encodeURIComponent(msg);
                  const cleanPhone = member.phone?.replace(/\D/g, '');
                  window.open(
                    cleanPhone
                      ? `https://wa.me/${cleanPhone}?text=${encoded}`
                      : `https://wa.me/?text=${encoded}`,
                    '_blank'
                  );
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

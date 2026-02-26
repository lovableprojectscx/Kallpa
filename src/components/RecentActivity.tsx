import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2, Activity } from "lucide-react";
import { format } from "date-fns";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-primary/10 text-primary" },
  expired: { label: "Vencido", className: "bg-coral/10 text-coral" },
  suspended: { label: "Suspendido", className: "bg-destructive/10 text-destructive" },
  inactive: { label: "Inactivo", className: "bg-secondary text-muted-foreground" },
};

export function RecentActivity() {
  const { user } = useAuth();

  const { data: recentCheckins = [], isLoading } = useQuery({
    queryKey: ['recent_activity', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          check_in_time,
          members (
            full_name,
            status
          )
        `)
        .eq('tenant_id', user.tenantId)
        .order('check_in_time', { ascending: false })
        .limit(6);

      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.tenantId,
    refetchInterval: 5000 // Refrescar cada 5 segs para sensación de tiempo real
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl border border-border/50 bg-card overflow-hidden h-full"
    >
      <div className="flex items-center justify-between border-b border-border/30 px-5 py-4 bg-secondary/10">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Check-ins Recientes
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground border-t-transparent" />}
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary tracking-wide">
          <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse glow-green" />
          EN VIVO
        </span>
      </div>
      <div className="divide-y divide-border/20">
        <AnimatePresence mode="popLayout">
          {recentCheckins.length === 0 && !isLoading ? (
            <div className="px-5 py-12 text-center flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-secondary/60 border border-border/50 flex items-center justify-center">
                <Activity className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No hay asistencias registradas.</p>
            </div>
          ) : (
            recentCheckins.map((checkin: any, i: number) => {
              const memberStatus = checkin.members?.status || 'inactive';
              const status = statusLabels[memberStatus] || statusLabels.inactive;
              const name = checkin.members?.full_name || 'Desconocido';
              const avatar = name.substring(0, 2).toUpperCase();
              const time = format(new Date(checkin.check_in_time), "HH:mm");

              return (
                <motion.div
                  key={checkin.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between px-5 py-3 transition-smooth hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold shadow-sm",
                      memberStatus === "active" ? "bg-primary/10 text-primary" :
                        memberStatus === "expired" ? "bg-coral/15 text-coral" : "bg-secondary text-muted-foreground"
                    )}>
                      {avatar}
                    </div>
                    <span className="text-sm font-medium text-foreground">{name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
                      {status.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md">{time}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

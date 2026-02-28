import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const hours = ["6am", "7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm"];

export function AttendanceChart() {
  const { user } = useAuth();

  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['attendance_chart', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('check_in_time')
        .eq('tenant_id', user.tenantId)
        .gte('check_in_time', startOfToday.toISOString());

      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.tenantId
  });

  // Agrupar asistencias por hora (índices 0-15 representan 6am a 9pm)
  const values = new Array(16).fill(0);

  attendanceData.forEach((record: any) => {
    const time = new Date(record.check_in_time);
    const hour = time.getHours();

    if (hour >= 6 && hour <= 21) {
      values[hour - 6] += 1;
    }
  });

  // Prevenir división por 0 en la gráfica
  const maxVal = Math.max(...values, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl border border-border/50 bg-card p-5 relative"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Flujo del Día
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Hoy</span>
          </div>
        </div>
      </div>
      <div className="flex h-40 items-end gap-1.5 relative">
        <AnimatePresence>
          {values.map((val, i) => (
            <div key={i} className="group relative flex flex-1 flex-col items-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(val / maxVal) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.02 * i, ease: [0.16, 1, 0.3, 1] }}
                className="w-full rounded-t-lg bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 relative"
              >
                <div
                  className="absolute bottom-0 w-full rounded-t-lg bg-primary/40 group-hover:bg-primary transition-colors shadow-[0_-4px_12px_rgba(var(--primary),0.2)]"
                  style={{ height: `${(val / maxVal) * 80}%` }}
                />
              </motion.div>
              {val > 0 && (
                <div className="absolute -top-6 text-[10px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {val}
                </div>
              )}
              <span className="mt-2 text-[8px] text-muted-foreground/60">{hours[i]}</span>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

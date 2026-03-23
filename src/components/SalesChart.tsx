import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

interface SalesChartProps {
  selectedMonth: number; // 0–11
  selectedYear: number;
}

/**
 * Gráfico de barras de ingresos diarios para el mes seleccionado.
 * Consulta la tabla `payments` y agrupa por día client-side.
 * Reemplaza al AttendanceChart cuando el dashboard está en modo "Ventas".
 * Hover sobre una barra muestra el monto exacto del día.
 */
export function SalesChart({ selectedMonth, selectedYear }: SalesChartProps) {
  const { user } = useAuth();

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthStart = new Date(selectedYear, selectedMonth, 1).toISOString();
  const monthEnd   = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

  const { data: payments = [], isLoading } = useQuery<{ amount: number; payment_date: string }[]>({
    queryKey: ["sales_chart", user?.tenantId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .eq("tenant_id", user.tenantId)
        .gte("payment_date", monthStart)
        .lte("payment_date", monthEnd);
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.tenantId,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  // Agrupa ingresos por día del mes (índice 0 = día 1)
  const dailyRevenue = useMemo(() => {
    const values = new Array(daysInMonth).fill(0);
    payments.forEach((p) => {
      if (!p.payment_date) return;
      const day = new Date(p.payment_date).getDate();
      if (day >= 1 && day <= daysInMonth) values[day - 1] += p.amount || 0;
    });
    return values;
  }, [payments, daysInMonth]);

  const maxVal = Math.max(...dailyRevenue, 1);
  const totalRevenue = dailyRevenue.reduce((a, b) => a + b, 0);
  const activeDays  = dailyRevenue.filter((v) => v > 0).length;

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-border/50 bg-card p-5 relative"
    >
      {/* Cabecera */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Ingresos del Mes
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-black text-primary font-mono leading-none">
            S/{totalRevenue.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {activeDays} {activeDays === 1 ? "día con ventas" : "días con ventas"}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="overflow-x-auto pb-1 -mx-2 px-2">
        <div
          className="flex h-40 items-end gap-[3px] relative border-b border-border/20 pb-1 px-1"
          style={{ minWidth: `${daysInMonth * 18}px` }}
        >
          {dailyRevenue.map((val, i) => {
            const heightPct = val > 0 ? Math.max((val / maxVal) * 100, 6) : 0;
            const isToday =
              new Date().getFullYear() === selectedYear &&
              new Date().getMonth() === selectedMonth &&
              new Date().getDate() === i + 1;

            return (
              <div key={i} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                {/* Tooltip */}
                {val > 0 && (
                  <div className="absolute -top-8 z-20 text-[10px] font-bold text-primary bg-background/95 border border-primary/30 px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none">
                    S/{val.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
                  </div>
                )}

                {/* Barra */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: val > 0 ? `${heightPct}%` : "2px" }}
                  transition={{ duration: 0.6, delay: 0.008 * i, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-full rounded-t-sm relative z-10 transition-colors ${
                    val > 0
                      ? isToday
                        ? "bg-primary"
                        : "bg-primary/25 group-hover:bg-primary/60"
                      : "bg-border/20"
                  }`}
                />

                {/* Etiqueta de día (solo cada 5 días + 1 y último) */}
                {(i === 0 || (i + 1) % 5 === 0 || i === daysInMonth - 1) && (
                  <span className={`mt-2 text-[9px] font-bold tabular-nums ${
                    isToday ? "text-primary" : "text-muted-foreground/40"
                  }`}>
                    {i + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

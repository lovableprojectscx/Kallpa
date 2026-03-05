import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2, DollarSign, TrendingUp, ShoppingBag } from "lucide-react";

interface SalesActivityProps {
  selectedDate: string; // YYYY-MM-DD
}

export function SalesActivity({ selectedDate }: SalesActivityProps) {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sales_activity", user?.tenantId, selectedDate],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      // Pagos registrados en la fecha seleccionada (inmutables — no cambian si el plan cambia)
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd   = `${selectedDate}T23:59:59`;

      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, amount, plan_name, plan_id, payment_type, created_at, member_id, members(full_name)")
        .eq("tenant_id", user.tenantId)
        .gte("payment_date", dayStart)
        .lte("payment_date", dayEnd)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("SalesActivity payments error:", error);
        return [];
      }
      if (!payments || payments.length === 0) return [];

      // Colores de planes (opcional — enriquece la UI)
      const planIds = [...new Set(payments.map((p: any) => p.plan_id).filter(Boolean))];
      let colorsMap: Record<string, string> = {};
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from("membership_plans")
          .select("id, color")
          .in("id", planIds);
        (plans || []).forEach((p: any) => { colorsMap[p.id] = p.color || "#7C3AED"; });
      }

      return payments.map((p: any) => ({
        id: p.id,
        full_name: (p.members as any)?.full_name || "Miembro",
        created_at: p.created_at,
        isNew: p.payment_type === 'new',
        plan: {
          name: p.plan_name || "Sin plan",
          price: p.amount || 0,
          color: colorsMap[p.plan_id] || "#7C3AED",
        },
      }));
    },
    enabled: !!user?.tenantId,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const totalRevenue = rows.reduce((sum, s) => sum + s.plan.price, 0);
  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl border border-border/50 bg-card overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-5 py-4 bg-secondary/10 shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Ventas del Día
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary tracking-wide">
          {isToday
            ? <><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> HOY</>
            : selectedDate}
        </span>
      </div>

      {/* Total */}
      {!isLoading && rows.length > 0 && (
        <div className="px-5 py-3 border-b border-border/20 bg-primary/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total recaudado
            </span>
          </div>
          <span className="text-base font-black text-primary font-mono">
            S/ {totalRevenue.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Lista */}
      <div className="divide-y divide-border/20 overflow-y-auto flex-1">
        <AnimatePresence mode="popLayout">
          {!isLoading && rows.length === 0 ? (
            <div className="px-5 py-12 text-center flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-secondary/60 border border-border/50 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isToday ? "No hay ventas registradas hoy." : "Sin ventas en esta fecha."}
              </p>
            </div>
          ) : (
            rows.map((sale, i) => {
              const avatar = sale.full_name.substring(0, 2).toUpperCase();
              const { name: planName, price, color: planColor } = sale.plan;

              return (
                <motion.div
                  key={sale.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm"
                      style={{ backgroundColor: planColor + "33", color: planColor }}
                    >
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sale.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: planColor + "22", color: planColor }}
                        >
                          {planName}
                        </span>
                        {sale.isNew && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            NUEVO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground/60" />
                    <span className="font-mono text-sm font-bold text-foreground">
                      S/ {price.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
                    </span>
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

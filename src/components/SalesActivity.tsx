import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2, DollarSign, TrendingUp, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SalesActivityProps {
  selectedDate: string; // YYYY-MM-DD
}

export function SalesActivity({ selectedDate }: SalesActivityProps) {
  const { user } = useAuth();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales_activity", user?.tenantId, selectedDate],
    queryFn: async () => {
      if (!user?.tenantId) return [];

      // Traer miembros cuya membresía inició en la fecha seleccionada
      // start_date se actualiza tanto en nuevas inscripciones como en renovaciones
      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          full_name,
          start_date,
          created_at,
          status,
          plan,
          membership_plans ( name, price, color )
        `)
        .eq("tenant_id", user.tenantId)
        .eq("start_date", selectedDate)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching sales activity:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.tenantId,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const totalRevenue = (sales as any[]).reduce(
    (sum, s) => sum + (s.membership_plans?.price || 0),
    0
  );

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
        {isToday && (
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary tracking-wide">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            HOY
          </span>
        )}
        {!isToday && (
          <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
            {format(new Date(selectedDate + "T00:00:00"), "d MMM", { locale: es })}
          </span>
        )}
      </div>

      {/* Total del día */}
      {!isLoading && sales.length > 0 && (
        <div className="px-5 py-3 border-b border-border/20 bg-primary/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total recaudado
            </span>
          </div>
          <span className="text-base font-black text-primary font-mono">
            S/ {totalRevenue.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Lista de ventas */}
      <div className="divide-y divide-border/20 overflow-y-auto flex-1">
        <AnimatePresence mode="popLayout">
          {!isLoading && sales.length === 0 ? (
            <div className="px-5 py-12 text-center flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-secondary/60 border border-border/50 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isToday ? "No hay ventas registradas hoy." : "Sin ventas en esta fecha."}
              </p>
            </div>
          ) : (
            (sales as any[]).map((sale, i) => {
              const name = sale.full_name || "Miembro";
              const avatar = name.substring(0, 2).toUpperCase();
              const planName = sale.membership_plans?.name || "Sin plan";
              const planColor = sale.membership_plans?.color || "#7C3AED";
              const price = sale.membership_plans?.price || 0;
              const isNew =
                sale.created_at?.split("T")[0] === selectedDate;

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
                    {/* Avatar con color del plan */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: planColor + "33", color: planColor }}
                    >
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: planColor + "22", color: planColor }}
                        >
                          {planName}
                        </span>
                        {isNew && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            NUEVO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Precio */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground/60" />
                    <span className="font-mono text-sm font-bold text-foreground">
                      S/ {price.toLocaleString("es-PE", { minimumFractionDigits: 0 })}
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

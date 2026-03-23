import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, TrendingUp, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Registro de un pago de membresía realizado por un miembro del gym.
 * Incluye los datos del miembro a través de un join con la tabla `members`.
 */
type MemberPayment = {
  id: string;
  member_id: string;
  plan_name: string;
  amount: number;
  duration_days: number;
  new_end_date: string;
  paid_at: string;
  mp_payment_id: string;
  members: { full_name: string; phone: string | null } | null;
};

/**
 * Página de historial de pagos de miembros.
 *
 * Muestra todos los pagos procesados vía Mercado Pago para los miembros del gym,
 * con estadísticas de resumen (ingresos totales, pagos del mes, miembros únicos)
 * y una tabla paginable con los detalles de cada transacción.
 *
 * Solo muestra pagos del propio tenant (tenant_id del admin autenticado).
 */
const Payments = () => {
  const { user } = useAuth();

  const { data: payments = [], isLoading } = useQuery<MemberPayment[]>({
    queryKey: ["member_payments_admin", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from("member_payments")
        .select("*, members(full_name, phone)")
        .eq("tenant_id", user.tenantId)
        .order("paid_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.tenantId,
  });

  // ── Estadísticas de resumen ───────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = payments.filter((p) => p.paid_at >= monthStart);
    const monthRevenue = thisMonth.reduce((acc, p) => acc + (p.amount || 0), 0);

    const uniqueMembers = new Set(payments.map((p) => p.member_id)).size;

    return { totalRevenue, monthRevenue, paymentsThisMonth: thisMonth.length, uniqueMembers };
  }, [payments]);

  /** Formatea un número como monto en soles peruanos */
  const formatSoles = (n: number) =>
    `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /** Formatea fecha ISO como cadena legible en hora local */
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between sm:items-end gap-3"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-tight">
            Pagos de Miembros
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isLoading
              ? "Cargando..."
              : `${payments.length} transacciones · pagos procesados vía Mercado Pago`}
          </p>
        </div>
      </motion.div>

      {/* Tarjetas de resumen */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          {
            label: "Ingresos Totales",
            value: formatSoles(stats.totalRevenue),
            icon: TrendingUp,
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Ingresos del Mes",
            value: formatSoles(stats.monthRevenue),
            icon: CreditCard,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Pagos Este Mes",
            value: String(stats.paymentsThisMonth),
            icon: CalendarDays,
            color: "text-amber-400",
            bg: "bg-amber-400/10",
          },
          {
            label: "Miembros que Pagaron",
            value: String(stats.uniqueMembers),
            icon: Users,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/50 bg-card/50 p-4 shadow-sm"
          >
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center mb-3", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Tabla de pagos */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/50 bg-card/50 shadow-sm overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20">
              <CreditCard className="h-10 w-10 text-primary/70" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Sin pagos registrados</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Cuando tus miembros paguen desde su portal con Mercado Pago, los pagos aparecerán aquí.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/20">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Miembro
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Plan
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Monto
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                    Duración
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Nueva Vencimiento
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Fecha Pago
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {p.members?.full_name || "—"}
                      </p>
                      {p.members?.phone && (
                        <p className="text-xs text-muted-foreground font-mono">{p.members.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.plan_name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-success">
                        {formatSoles(p.amount || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell">
                      {p.duration_days ? `${p.duration_days}d` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                      {p.new_end_date || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Payments;

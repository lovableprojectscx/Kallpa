import { StatCard } from "@/components/StatCard";
import { RecentActivity } from "@/components/RecentActivity";
import { SalesActivity } from "@/components/SalesActivity";
import { AttendanceChart } from "@/components/AttendanceChart";
import { SalesChart } from "@/components/SalesChart";
import {
  Users, UserCheck, AlertCircle, BarChart3, Activity,
  TrendingUp, DollarSign, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

/**
 * Panel de control principal del gimnasio.
 *
 * Dos modos de vista:
 * - "operativo": métricas de membresía y asistencia del día.
 * - "ventas": recaudación e inscripciones del mes seleccionado.
 *
 * Los datos vienen del RPC `get_dashboard_metrics`.
 * Superadmin es redirigido a /admin.
 */
const Dashboard = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"operativo" | "ventas">("operativo");
  const [selectedDate]  = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-v2", user?.tenantId, viewMode, selectedDate, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!user?.tenantId || user?.role === "superadmin") return null;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStr = startOfToday.toLocaleDateString("sv-SE");

      const dayStart = new Date(selectedDate + "T00:00:00");
      const dayEnd   = new Date(selectedDate + "T23:59:59");

      const startOfSelectedMonth = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
      const endOfSelectedMonth   = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const { data, error } = await supabase.rpc("get_dashboard_metrics", {
        p_tenant_id:    user.tenantId,
        p_day_start:    dayStart.toISOString(),
        p_day_end:      dayEnd.toISOString(),
        p_month_start:  startOfSelectedMonth.toISOString(),
        p_month_end:    endOfSelectedMonth.toISOString(),
        p_today_start:  startOfToday.toISOString(),
        p_today_str:    todayStr,
      });

      if (error) { console.error("Dashboard RPC error:", error); return null; }
      return data;
    },
    enabled: !!user?.tenantId && user?.role !== "superadmin",
    refetchInterval: 60000,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  if (user?.role === "superadmin") return <Navigate to="/admin" replace />;

  const fmt = (n: any) => (n == null ? "—" : String(n));
  const fmtSoles = (n: any) =>
    n == null ? "—" : `S/${Number(n).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;

  // Navegar mes anterior / siguiente
  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth())) return;
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };
  const isCurrentMonth =
    selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Panel de Control
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {viewMode === "operativo" ? "Resumen operativo de hoy" : `Ventas — ${MONTHS[selectedMonth]} ${selectedYear}`}
          </p>
        </motion.div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de mes (solo en modo ventas) */}
          {viewMode === "ventas" && (
            <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl px-1 py-1">
              <button
                onClick={prevMonth}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-xs font-semibold text-foreground px-2 min-w-[120px] text-center">
                {MONTHS[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Toggle operativo / ventas */}
          <div className="flex items-center bg-secondary/30 border border-border/50 rounded-xl p-1">
            <button
              onClick={() => setViewMode("operativo")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200",
                viewMode === "operativo"
                  ? "bg-card text-foreground shadow border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="h-3.5 w-3.5" /> Operativo
            </button>
            <button
              onClick={() => setViewMode("ventas")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200",
                viewMode === "ventas"
                  ? "bg-card text-foreground shadow border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Ventas
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <AnimatePresence mode="wait">
        {viewMode === "operativo" ? (
          <motion.div
            key="kpi-operativo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <StatCard
              title="Miembros Activos"
              value={fmt(stats?.activeMembers)}
              subtitle={`de ${fmt(stats?.totalMembers)} registrados`}
              icon={Users}
              accent="positive"
            />
            <StatCard
              title="Entradas Hoy"
              value={fmt(stats?.checkinsToday)}
              subtitle="asistencias registradas"
              icon={UserCheck}
              accent="neutral"
            />
            <StatCard
              title="Vencen Esta Semana"
              value={fmt(stats?.expiringSoon ?? stats?.expiredMembers)}
              subtitle="necesitan renovar pronto"
              icon={AlertCircle}
              accent={Number(stats?.expiringSoon ?? stats?.expiredMembers) > 0 ? "warning" : "neutral"}
            />
            <StatCard
              title="Sin Renovar"
              value={fmt(stats?.expiredMembers)}
              subtitle="membresías vencidas"
              icon={CalendarDays}
              accent={Number(stats?.expiredMembers) > 0 ? "negative" : "neutral"}
            />
          </motion.div>
        ) : (
          <motion.div
            key="kpi-ventas"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <StatCard
              title="Ingresos del Mes"
              value={fmtSoles(stats?.monthlyRevenue)}
              subtitle={`${fmt(stats?.salesMonthly)} pagos registrados`}
              icon={DollarSign}
              accent="positive"
            />
            <StatCard
              title="Nuevos Miembros"
              value={fmt(stats?.salesMonthly)}
              subtitle="inscripciones este mes"
              icon={Users}
              accent="neutral"
            />
            <StatCard
              title="Plan Más Vendido"
              value={stats?.topPlan || "—"}
              subtitle="membresía más elegida"
              icon={TrendingUp}
              accent="neutral"
            />
            <StatCard
              title="Ticket Promedio"
              value={fmtSoles(stats?.avgTicket)}
              subtitle="ingreso por pago"
              icon={BarChart3}
              accent="neutral"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Gráfico + Panel lateral ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          {viewMode === "ventas"
            ? <SalesChart selectedMonth={selectedMonth} selectedYear={selectedYear} />
            : <AttendanceChart />
          }
        </div>
        <div className="lg:col-span-2">
          {viewMode === "ventas"
            ? <SalesActivity selectedDate={selectedDate} />
            : <RecentActivity />
          }
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

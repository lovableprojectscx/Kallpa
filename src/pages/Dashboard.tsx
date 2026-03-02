
import { StatCard } from "@/components/StatCard";
import { RetentionPanel } from "@/components/RetentionPanel";
import { RecentActivity } from "@/components/RecentActivity";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Users, UserCheck, TrendingUp, AlertCircle, Loader2, BarChart3, DollarSign, PieChart, ArrowUpRight, ArrowDownRight, Activity, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { cn } from "@/lib/utils";

const Index = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'operational' | 'sales'>('operational');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Cargar métricas principales — siempre ejecutar el hook (Rules of Hooks)
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats-v2', user?.tenantId, viewMode, selectedDate, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!user?.tenantId || user?.role === 'superadmin') return null;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStr = startOfToday.toLocaleDateString('sv-SE');

      // Fecha seleccionada (Día)
      const dayStart = new Date(selectedDate + 'T00:00:00');
      const dayEnd = new Date(selectedDate + 'T23:59:59');

      // Mes seleccionado
      const startOfSelectedMonth = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
      const endOfSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      // Inicio del mes actual (para comparativas internas si se desea)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Inicio del mes anterior
      const startOfLastMonth = new Date(startOfMonth);
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

      const { data, error } = await supabase.rpc('get_dashboard_metrics', {
        p_tenant_id: user.tenantId,
        p_day_start: dayStart.toISOString(),
        p_day_end: dayEnd.toISOString(),
        p_month_start: startOfSelectedMonth.toISOString(),
        p_month_end: endOfSelectedMonth.toISOString(),
        p_today_start: startOfToday.toISOString(),
        p_today_str: todayStr
      });

      if (error) {
        console.error("RPC Error (Dashboard Metrics):", error);
        return null;
      }

      return data;
    },
    enabled: !!user?.tenantId && user?.role !== 'superadmin',
    refetchInterval: 60000 // Sincronizar cada minuto para evitar sobrecarga y parpadeo
  });

  // Redirigir la cuenta maestra a su panel global (después de todos los hooks)
  if (user?.role === 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  const currentDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Panel de Control</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground capitalize font-medium opacity-70">
                {viewMode === 'operational' ? 'Gestión Operativa' : 'Analítica de Ventas'}
              </p>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              <p className="text-sm text-muted-foreground/60 font-medium">{currentDate}</p>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'sales' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-secondary/40 border border-border/50 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30 transition-all text-foreground"
                />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-secondary/40 border border-border/50 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                >
                  {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-2xl border border-border/50 shadow-inner">
              <button
                onClick={() => setViewMode('operational')}
                className={cn(
                  "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300",
                  viewMode === 'operational'
                    ? "bg-card text-foreground shadow-lg border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Operativo
                </div>
              </button>
              <button
                onClick={() => setViewMode('sales')}
                className={cn(
                  "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300",
                  viewMode === 'sales'
                    ? "bg-card text-foreground shadow-lg border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3 w-3" />
                  Ventas
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <AnimatePresence mode="wait">
          {viewMode === 'operational' ? (
            <motion.div
              key="operational-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4"
            >
              <StatCard
                title="Usuarios"
                value={!stats ? "..." : String(stats?.totalMembers || 0)}
                changeType="neutral"
                icon={Users}
                subtitle="Total registrados"
                change="Activos"
                comparisonLabel={`${stats?.activeMembers || 0} suscritos`}
              />
              <StatCard
                title="Vencimientos"
                value={!stats ? "..." : String(stats?.expiredMembers || 0)}
                changeType={Number(stats?.expiredMembers) > 0 ? "negative" : "positive"}
                icon={AlertCircle}
                subtitle="Ya no renovaron"
                change={stats?.expiredMembers > 0 ? "⚠️" : "Limpio"}
                comparisonLabel="pendientes"
              />
              <StatCard
                title="Desertores"
                value={!stats ? "..." : String(stats?.desertores || 0)}
                changeType="neutral"
                icon={TrendingDown}
                subtitle="Ya no regresan"
                change="Fuga"
                comparisonLabel="histórica"
              />
              <StatCard
                title="Presencia"
                value={!stats ? "..." : String(stats?.checkinsToday || 0)}
                changeType="neutral"
                icon={UserCheck}
                subtitle="Hoy entraron"
                change="Hoy"
                comparisonLabel="en vivo"
              />
            </motion.div>
          ) : (
            <motion.div
              key="sales-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4"
            >
              <StatCard
                title="Ventas del Día"
                value={!stats ? "..." : String(stats?.salesDay || 0)}
                change="Inscritos"
                changeType="positive"
                comparisonLabel="en fecha"
                icon={Activity}
                subtitle="Registros seleccionados"
              />
              <StatCard
                title="Ventas del Mes"
                value={!stats ? "..." : String(stats?.salesMonthly || 0)}
                change="Total"
                changeType="neutral"
                comparisonLabel="mes elegido"
                icon={BarChart3}
                subtitle="Acumulado mensual"
              />
              <StatCard
                title="Recaudación"
                value={!stats ? "..." : `S/${(stats?.monthlyRevenue || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                change="Ingreso"
                changeType="positive"
                comparisonLabel="estimado"
                icon={DollarSign}
                subtitle="Basado en planes"
              />
              <StatCard
                title="Plan Líder"
                value={!stats ? "..." : stats?.topPlan || "N/A"}
                change="Popular"
                changeType="positive"
                comparisonLabel="preferencia"
                icon={PieChart}
                subtitle="Plan estrella"
              />
              <StatCard
                title="Ticket Medio"
                value={!stats ? "..." : `S/${(stats?.avgTicket || 0).toFixed(0)}`}
                change="Promedio"
                changeType="neutral"
                comparisonLabel="por socio"
                icon={TrendingUp}
                subtitle="Valor membresía"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Charts + Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <AttendanceChart />
          </div>
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
        </div>

        {/* Retention */}
        <RetentionPanel />
      </div>
    </>
  );
};

export default Index;

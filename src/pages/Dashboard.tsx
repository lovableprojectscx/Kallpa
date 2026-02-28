import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { RetentionPanel } from "@/components/RetentionPanel";
import { RecentActivity } from "@/components/RecentActivity";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Users, UserCheck, TrendingUp, AlertCircle, Loader2, BarChart3, DollarSign, PieChart, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
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

  // Redirigir la cuenta maestra a su panel global
  if (user?.role === 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  // Cargar métricas principales
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats-v2', user?.tenantId, new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      if (!user?.tenantId) return null;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Inicio del mes actual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Inicio del mes anterior
      const startOfLastMonth = new Date(startOfMonth);
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

      const [activeMembersRes, checkinsTodayRes, inactiveMembersRes, expiredActiveRes, allMembersRes,
        activeMembersData, plansData, lastMonthActiveRes] = await Promise.all([
          // Conteos básicos
          supabase.from('members').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId).eq('status', 'active'),
          supabase.from('attendance').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId).gte('check_in_time', startOfToday.toISOString()),
          // Miembros inactivos
          supabase.from('members').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId).eq('status', 'inactive'),
          // Miembros activos pero con plan vencido
          supabase.from('members').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId).eq('status', 'active')
            .lt('end_date', startOfToday.toISOString().split('T')[0]),
          supabase.from('members').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId),
          // Miembros activos con su plan para calcular ingresos
          supabase.from('members').select('plan')
            .eq('tenant_id', user.tenantId).eq('status', 'active'),
          // Planes del tenant
          supabase.from('membership_plans').select('id, price')
            .eq('tenant_id', user.tenantId),
          // Miembros activos el mes pasado (registrados antes de inicio de mes actual)
          supabase.from('members').select('*', { count: 'exact', head: true })
            .eq('tenant_id', user.tenantId).eq('status', 'active')
            .lt('created_at', startOfMonth.toISOString()),
        ]).catch(err => {
          console.error("Error fetching dashboard counts:", err);
          return [];
        });

      // Asegurarse de tener `expiredMembers` sumando los resultados
      const expiredMembersCount = (inactiveMembersRes?.count || 0) + (expiredActiveRes?.count || 0);

      // Calcular ingresos mensuales: suma del precio del plan de cada miembro activo
      const planPriceMap: Record<string, number> = {};
      (plansData.data || []).forEach((p: any) => { planPriceMap[p.id] = p.price; });

      const monthlyRevenue = (activeMembersData.data || []).reduce((sum: number, m: any) => {
        return sum + (planPriceMap[m.plan] || 0);
      }, 0);

      // Ingresos mes anterior (misma lógica con conteo del mes pasado × precio promedio)
      const lastMonthCount = lastMonthActiveRes.count || 0;
      const avgPrice = monthlyRevenue / Math.max((activeMembersRes.count || 1), 1);
      const lastMonthRevenue = lastMonthCount * avgPrice;

      const revenueChange = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(0)
        : null;

      // Plan con más miembros
      const planDistribution: Record<string, number> = {};
      (activeMembersData.data || []).forEach((m: any) => {
        planDistribution[m.plan] = (planDistribution[m.plan] || 0) + 1;
      });

      let topPlanId = null;
      let maxMembers = 0;
      Object.entries(planDistribution).forEach(([id, count]) => {
        if (count > maxMembers) {
          maxMembers = count;
          topPlanId = id;
        }
      });

      const topPlanName = topPlanId ? planPriceMap[topPlanId] ? (plansData.data || []).find((p: any) => p.id === topPlanId)?.name : "Personalizado" : "N/A";
      const avgTicket = activeMembersRes.count ? monthlyRevenue / activeMembersRes.count : 0;

      return {
        activeMembers: activeMembersRes.count || 0,
        totalMembers: allMembersRes.count || 0,
        checkinsToday: checkinsTodayRes.count || 0,
        expiredMembers: expiredMembersCount,
        monthlyRevenue,
        revenueChange: revenueChange ? Number(revenueChange) : null,
        lastMonthRevenue,
        topPlan: topPlanName,
        avgTicket,
        retentionRate: allMembersRes.count ? ((activeMembersRes.count / allMembersRes.count) * 100).toFixed(1) : "0"
      };
    },
    enabled: !!user?.tenantId,
    refetchInterval: 10000 // Sincronizar estadísticas en tiempo real
  });

  const currentDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Panel de Control</h1>
            <p className="text-sm text-muted-foreground capitalize font-medium opacity-70">
              {viewMode === 'operational' ? 'Gestión Operativa' : 'Analítica de Ventas'} · {currentDate}
            </p>
          </motion.div>

          <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-2xl w-fit border border-border/50 shadow-inner">
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

        {/* Stats Grid */}
        <AnimatePresence mode="wait">
          {viewMode === 'operational' ? (
            <motion.div
              key="operational-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
            >
              <StatCard
                title="Socios Activos"
                value={isLoading ? "..." : String(stats?.activeMembers || 0)}
                changeType="neutral"
                icon={Users}
                subtitle="Socio con plan vigente hoy"
                change="Total"
                comparisonLabel={`de ${stats?.totalMembers || 0}`}
              />
              <StatCard
                title="Check-ins Hoy"
                value={isLoading ? "..." : String(stats?.checkinsToday || 0)}
                changeType="neutral"
                icon={UserCheck}
                subtitle="Accesos registrados hoy"
                change="Actividad"
                comparisonLabel="del día"
              />
              <StatCard
                title="Tasa Retención"
                value={isLoading ? "..." : `${stats?.retentionRate}%`}
                change="Salud"
                changeType={(Number(stats?.retentionRate) || 0) > 80 ? "positive" : "neutral"}
                comparisonLabel="Del Gym"
                icon={TrendingUp}
                subtitle="Fidelidad de miembros"
              />
              <StatCard
                title="Alertas"
                value={isLoading ? "..." : String(stats?.expiredMembers || 0)}
                change={stats?.expiredMembers && stats.expiredMembers > 0 ? "Revisar" : "Limpio"}
                changeType={stats?.expiredMembers && stats.expiredMembers > 0 ? "negative" : "positive"}
                comparisonLabel="Inactivos"
                icon={AlertCircle}
                subtitle="Planes vencidos hoy"
              />
            </motion.div>
          ) : (
            <motion.div
              key="sales-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
            >
              <StatCard
                title="Recaudación Mes"
                value={isLoading ? "..." : `S/${(stats?.monthlyRevenue || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                change={stats?.revenueChange != null ? `${Math.abs(stats.revenueChange)}%` : '0%'}
                changeType={stats?.revenueChange != null ? (stats.revenueChange >= 0 ? 'positive' : 'negative') : 'neutral'}
                comparisonLabel="vs mes ant."
                icon={DollarSign}
                subtitle="Ingreso total proyectado"
              />
              <StatCard
                title="Ticket Promedio"
                value={isLoading ? "..." : `S/${(stats?.avgTicket || 0).toFixed(2)}`}
                change="Valor"
                changeType="neutral"
                comparisonLabel="Por Socio"
                icon={PieChart}
                subtitle="Gasto medio membresía"
              />
              <StatCard
                title="Plan Estrella"
                value={isLoading ? "..." : String(stats?.topPlan || "N/A")}
                change="Líder"
                changeType="positive"
                comparisonLabel="Preferencia"
                icon={TrendingUp}
                subtitle="Plan con más inscritos"
              />
              <StatCard
                title="Potencial"
                value={isLoading ? "..." : `S/${((stats?.totalMembers || 0) * (stats?.avgTicket || 0)).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}
                change="Crecimiento"
                changeType="positive"
                comparisonLabel="Máximo"
                icon={TrendingUp}
                subtitle="Si todos renovaran"
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
    </Layout>
  );
};

export default Index;

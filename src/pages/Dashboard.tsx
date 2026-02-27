import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { RetentionPanel } from "@/components/RetentionPanel";
import { RecentActivity } from "@/components/RecentActivity";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Users, UserCheck, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const Index = () => {
  const { user } = useAuth();

  // Redirigir la cuenta maestra a su panel global
  if (user?.role === 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  // Cargar métricas principales
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats-v2', user?.tenantId],
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

      return {
        activeMembers: activeMembersRes.count || 0,
        totalMembers: allMembersRes.count || 0,
        checkinsToday: checkinsTodayRes.count || 0,
        expiredMembers: expiredMembersCount,
        monthlyRevenue,
        revenueChange: revenueChange ? Number(revenueChange) : null,
        lastMonthRevenue,
      };
    },
    enabled: !!user?.tenantId
  });


  const currentDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-2xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">Resumen operativo · {currentDate}</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Miembros Activos"
            value={isLoading ? "..." : String(stats?.activeMembers || 0)}
            changeType="neutral"
            icon={Users}
            subtitle={`de ${stats?.totalMembers || 0} registrados`}
          />
          <StatCard
            title="Check-ins Hoy"
            value={isLoading ? "..." : String(stats?.checkinsToday || 0)}
            changeType="neutral"
            icon={UserCheck}
          />
          <StatCard
            title="Ingresos del Mes"
            value={isLoading ? "..." : `S/${(stats?.monthlyRevenue || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={
              stats?.revenueChange != null
                ? `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% vs mes ant.`
                : stats?.monthlyRevenue === 0
                  ? 'Asigna planes a miembros'
                  : 'vs mes anterior'
            }
            changeType={
              stats?.revenueChange != null
                ? stats.revenueChange >= 0 ? 'positive' : 'negative'
                : 'neutral'
            }
            icon={TrendingUp}
          />
          <StatCard
            title="Vencimientos"
            value={isLoading ? "..." : String(stats?.expiredMembers || 0)}
            change="histórico"
            changeType={stats?.expiredMembers && stats.expiredMembers > 0 ? "negative" : "neutral"}
            icon={AlertCircle}
          />
        </div>

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

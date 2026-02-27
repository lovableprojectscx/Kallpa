import { Layout } from "@/components/Layout";
import { RetentionPanel } from "@/components/RetentionPanel";
import { motion } from "framer-motion";
import { TrendingDown, UserMinus, RefreshCw, Target, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { differenceInDays } from "date-fns";

const Retention = () => {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['retention_stats', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;

      const { data, error } = await supabase
        .from('members')
        .select(`
          status,
          created_at,
          attendance ( check_in_time )
        `)
        .eq('tenant_id', user.tenantId)
        .order('check_in_time', { foreignTable: 'attendance', ascending: false })
        .limit(1, { foreignTable: 'attendance' });

      if (error) {
        console.error(error);
        return null;
      }

      const today = new Date();
      let totalActive = 0;
      let atRisk = 0;
      let droppedThisMonth = 0;

      data?.forEach((member: any) => {
        if (member.status === 'active') {
          totalActive++;
          const lastCheckIn = member.attendance?.[0]?.check_in_time;
          const lastDate = lastCheckIn ? new Date(lastCheckIn) : new Date(member.created_at);
          if (differenceInDays(today, lastDate) >= 7) {
            atRisk++;
          }
        } else if (member.status === 'expired' || member.status === 'suspended') {
          droppedThisMonth++;
        }
      });

      const retentionRate = totalActive > 0 ? Math.round(((totalActive - atRisk) / totalActive) * 100) : 100;

      return {
        retentionRate,
        atRisk,
        droppedThisMonth,
        reengaged: 0 // Mock temporal hasta habilitar auditorías de status
      };
    },
    enabled: !!user?.tenantId
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground flex items-center gap-2">
            Central de Retención
            {isLoading && <Loader2 className="h-4 sm:h-5 w-4 sm:w-5 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Monitorea y recupera miembros en riesgo</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            title="Tasa de Retención"
            value={isLoading ? "..." : `${stats?.retentionRate}%`}
            change={!isLoading && stats?.retentionRate! >= 90 ? "Óptimo" : "Requiere Acción"}
            changeType={!isLoading && stats?.retentionRate! >= 90 ? "positive" : "negative"}
            icon={Target}
          />
          <StatCard
            title="En Riesgo"
            value={isLoading ? "..." : `${stats?.atRisk}`}
            change="7+ días sin visita"
            changeType={!isLoading && stats?.atRisk! > 0 ? "negative" : "neutral"}
            icon={TrendingDown}
          />
          <StatCard
            title="Bajas Totales"
            value={isLoading ? "..." : `${stats?.droppedThisMonth}`}
            change="vencidos o suspendidos"
            changeType="neutral"
            icon={UserMinus}
          />
          <StatCard
            title="Reenganchados"
            value={isLoading ? "..." : `${stats?.reengaged || 0}`}
            change="miembros recuperados"
            changeType="neutral"
            icon={RefreshCw}
          />
        </div>

        <RetentionPanel />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-border/50 bg-card p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Acciones de Reenganche</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { title: "WhatsApp Automático", desc: "Enviar mensaje personalizado tras 7 días de inactividad", active: true },
              { title: "Pase de Invitado", desc: "Ofrecer un pase gratuito para acompañante como incentivo", active: true },
              { title: "Descuento de Recuperación", desc: "10% de descuento si renueva dentro de las próximas 48h", active: false },
            ].map((action) => (
              <div key={action.title} className="rounded-lg border border-border/30 bg-secondary/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{action.title}</span>
                  <div className={`h-2 w-2 rounded-full ${action.active ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                </div>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Retention;

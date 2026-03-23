import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { KeyRound, Users, Gift, DollarSign, TrendingUp, Loader2, ArrowUpRight, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [
        availableLicensesEx,
        clientsCountEx,
        recentLicensesEx,
        affiliatesRes,
        affiliateCreditLogsRes,
        redeemedAllRes,
        redeemedThisMonthRes,
        redeemedLastMonthRes,
      ] = await Promise.all([
        supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase
          .from('licenses')
          .select('code, redeemed_at, price_pen, duration_months, tenant:tenants(name)')
          .eq('status', 'redeemed')
          .order('redeemed_at', { ascending: false })
          .limit(6),
        supabase.from('affiliates').select('id, profile:profiles!profile_id(full_name), invites:profiles!referred_by(id, tenant_id)'),
        supabase.from('affiliate_credit_logs').select('affiliate_profile_id, amount'),
        supabase.from('licenses').select('price_pen').eq('status', 'redeemed'),
        supabase.from('licenses').select('price_pen').eq('status', 'redeemed').gte('redeemed_at', startOfMonth),
        supabase.from('licenses').select('price_pen').eq('status', 'redeemed').gte('redeemed_at', startOfLastMonth).lte('redeemed_at', endOfLastMonth),
      ]);

      // Ingresos totales y por mes
      const allRedeemed = redeemedAllRes.data || [];
      const thisMonthRedeemed = redeemedThisMonthRes.data || [];
      const lastMonthRedeemed = redeemedLastMonthRes.data || [];

      const totalRevenue = allRedeemed.reduce((sum: number, l: any) => sum + (l.price_pen || 0), 0);
      const thisMonthRevenue = thisMonthRedeemed.reduce((sum: number, l: any) => sum + (l.price_pen || 0), 0);
      const lastMonthRevenue = lastMonthRedeemed.reduce((sum: number, l: any) => sum + (l.price_pen || 0), 0);

      const revenueGrowth = lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : thisMonthRevenue > 0 ? 100 : 0;

      // Top Afiliados usando créditos reales de affiliate_credit_logs
      const affiliates = affiliatesRes.data || [];
      const creditLogs = affiliateCreditLogsRes.data || [];

      const topAffiliates = affiliates
        .map((a: any) => {
          const invites = a.invites || [];
          const totalEarned = creditLogs
            .filter((log: any) => log.affiliate_profile_id === a.id)
            .reduce((sum: number, log: any) => sum + (log.amount || 0), 0);
          return {
            name: a.profile?.full_name || 'Afiliado',
            referrals: invites.length,
            credits: totalEarned,
          };
        })
        .filter((a: any) => a.credits > 0)
        .sort((a: any, b: any) => b.credits - a.credits)
        .slice(0, 5);

      return {
        availableLicenses: availableLicensesEx.count || 0,
        totalClients: clientsCountEx.count || 0,
        recentLicenses: recentLicensesEx.data || [],
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        revenueGrowth,
        topAffiliates,
      };
    }
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const {
    availableLicenses = 0,
    totalClients = 0,
    recentLicenses = [],
    totalRevenue = 0,
    thisMonthRevenue = 0,
    lastMonthRevenue = 0,
    revenueGrowth = 0,
    topAffiliates = [],
  } = data || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl text-foreground">Panel Maestro</h1>
          <p className="text-sm text-muted-foreground">Estadísticas globales del SaaS KALLPA</p>
        </motion.div>

        {/* Fila 1: Stats principales */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Gimnasios Activos</p>
                  <p className="stat-number text-2xl text-foreground">{totalClients}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <Users className="h-4 w-4 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Ingresos este mes</p>
                  <p className="stat-number text-2xl text-foreground">S/ {thisMonthRevenue.toLocaleString('es-PE')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className={`h-3 w-3 ${revenueGrowth >= 0 ? 'text-success' : 'text-coral rotate-90'}`} />
                    <span className={`text-[10px] ${revenueGrowth >= 0 ? 'text-success' : 'text-coral'}`}>
                      {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}% vs {new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('es-ES', { month: 'long' })}
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Ingresos Totales</p>
                  <p className="stat-number text-2xl text-foreground">S/ {totalRevenue.toLocaleString('es-PE')}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">acumulado histórico</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Licencias Disponibles</p>
                  <p className="stat-number text-2xl text-foreground">{availableLicenses}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">sin canjear</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fila 2: Detalle */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Últimas licencias canjeadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Últimas Licencias Canjeadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no se ha canjeado ninguna licencia.</p>
              ) : (
                recentLicenses.map((l: any) => (
                  <div key={l.code} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-foreground truncate">{l.code}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{l.tenant?.name || 'Gimnasio Desconocido'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/50">
                        {l.duration_months}m
                      </Badge>
                      {l.price_pen > 0 && (
                        <span className="text-[10px] text-success font-medium">S/ {l.price_pen}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {l.redeemed_at ? new Date(l.redeemed_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Top Afiliados */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Top Afiliados</CardTitle>
                <span className="text-[10px] text-muted-foreground">por créditos ganados</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {topAffiliates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/10 rounded-lg border border-dashed border-border/50">
                  <Gift className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-foreground font-medium">Sin actividad de afiliados</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] mt-1">
                    Los créditos aparecerán cuando un afiliado active referidos.
                  </p>
                </div>
              ) : (
                topAffiliates.map((a: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-3 py-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground/50 w-4 shrink-0">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.referrals} referidos</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-primary">{a.credits} pts</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

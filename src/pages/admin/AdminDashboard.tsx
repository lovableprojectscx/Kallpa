import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { KeyRound, Users, Gift, DollarSign, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      // Usar Promise.all para hacer los conteos en paralelo
      const [licensesCountEx, activeLicensesEx, clientsCountEx, recentLicensesEx, affiliatesRes, redeemedLicensesRes] = await Promise.all([
        supabase.from('licenses').select('*', { count: 'exact', head: true }),
        supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'redeemed'),
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase
          .from('licenses')
          .select(`
            code, 
            redeemed_at,
            tenant:tenants(name)
          `)
          .eq('status', 'redeemed')
          .order('redeemed_at', { ascending: false })
          .limit(5),
        supabase.from('affiliates').select('id, profile:profiles!profile_id(full_name), invites:profiles!referred_by(id, tenant_id)'),
        supabase.from('licenses').select('redeemed_by').eq('status', 'redeemed')
      ]);

      // Calcular Top Afiliados y Créditos
      const affiliates = affiliatesRes.data || [];
      const licensesInfo = redeemedLicensesRes.data || [];

      let totalAffiliateCredits = 0;
      const calcAffiliates = affiliates.map((a: any) => {
        const invites = a.invites || [];
        const activatedCount = invites.filter((inv: any) => inv.tenant_id && licensesInfo.some(l => l.redeemed_by === inv.tenant_id)).length;
        const credits = activatedCount * 50; // $50 por gimnasio activo
        totalAffiliateCredits += credits;
        return {
          name: a.profile?.full_name || 'Afiliado',
          referrals: invites.length,
          activated: activatedCount,
          credits: credits
        };
      });

      // Ordenar para obtener el Top 3
      calcAffiliates.sort((a, b) => b.credits - a.credits);
      const topAffiliates = calcAffiliates.slice(0, 3);

      return {
        totalLicenses: licensesCountEx.count || 0,
        activeLicenses: activeLicensesEx.count || 0,
        totalClients: clientsCountEx.count || 0,
        recentLicenses: recentLicensesEx.data || [],
        totalAffiliateCredits,
        topAffiliates
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

  const { totalLicenses = 0, activeLicenses = 0, totalClients = 0, recentLicenses = [], totalAffiliateCredits = 0, topAffiliates = [] } = data || {};

  const stats = [
    { title: "Licencias Creadas", value: totalLicenses, icon: KeyRound, color: "text-primary" },
    { title: "Licencias Activas", value: activeLicenses, icon: KeyRound, color: "text-success" },
    { title: "Gimnasios Clientes", value: totalClients, icon: Users, color: "text-foreground" },
    { title: "Créditos Generados", value: `S/ ${totalAffiliateCredits}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl text-foreground">Panel Maestro</h1>
          <p className="text-sm text-muted-foreground">Estadísticas globales de uso del SaaS KALLPA</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.title}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="stat-number text-xl text-foreground">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Últimas Licencias Canjeadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no se ha canjeado ninguna licencia.</p>
              ) : (
                recentLicenses.map((l: any) => (
                  <div key={l.code} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5">
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">{l.code}</p>
                      <p className="text-[10px] text-muted-foreground">{l.tenant?.name || 'Gimnasio Desconocido'}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {l.redeemed_at ? new Date(l.redeemed_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top Afiliados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topAffiliates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/10 rounded-lg border border-dashed border-border/50">
                  <Gift className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-foreground font-medium">No hay afiliados registrados</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] mt-1">
                    Crea líderes de ventas desde la pestaña de afiliados.
                  </p>
                </div>
              ) : (
                topAffiliates.map((a: any, index: number) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-foreground">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.referrals} referidos ({a.activated} activos) · S/ {a.credits}</p>
                    </div>
                    <Gift className={`h-3.5 w-3.5 ${a.credits > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
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

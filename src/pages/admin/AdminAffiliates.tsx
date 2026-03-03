import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Gift, Users, Zap, Loader2, Star, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const CREDITS_PER_MONTH = 100; // 100 créditos = 1 mes gratis

const AdminAffiliates = () => {

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['admin-affiliates'],
    queryFn: async () => {
      // 1. Afiliados con perfil y créditos reales desde BD
      const { data: affs, error: affErr } = await supabase
        .from('affiliates')
        .select(`
          id,
          code,
          status,
          credits_balance,
          profile:profiles!profile_id(full_name, email, role),
          invites:profiles!referred_by(id, tenant_id)
        `);

      if (affErr) throw affErr;

      // 2. Historial de créditos ganados por cada afiliado
      const { data: creditLogs } = await supabase
        .from('affiliate_credit_logs')
        .select('affiliate_profile_id, amount');

      // 3. Licencias canjeadas para saber activaciones reales
      const { data: licenses } = await supabase
        .from('licenses')
        .select('redeemed_by, tenant:tenants(name)')
        .eq('status', 'redeemed');

      return affs
        .filter((a: any) => a.profile?.role !== 'superadmin')
        .map((a: any) => {
          const invites = a.invites || [];
          const numInvites = invites.length;

          // Activaciones reales (referidos con licencia activa)
          const activated = invites
            .filter((inv: any) => inv.tenant_id)
            .filter((inv: any) => (licenses || []).some((l: any) => l.redeemed_by === inv.tenant_id))
            .length;

          // Créditos totales ganados históricamente
          const totalEarned = (creditLogs || [])
            .filter((log: any) => log.affiliate_profile_id === a.profile?.id)
            .reduce((sum: number, log: any) => sum + (log.amount || 0), 0);

          // Créditos actuales disponibles (desde la tabla affiliates)
          const creditsBalance = a.credits_balance || 0;

          // Meses canjeados = (ganados - disponibles) / 100
          const mesesCanjeados = Math.floor((totalEarned - creditsBalance) / CREDITS_PER_MONTH);

          // Progreso hacia próximo mes
          const progressPct = Math.min((creditsBalance % CREDITS_PER_MONTH), 100);

          return {
            id: a.id,
            name: a.profile?.full_name || a.profile?.email || 'Usuario',
            email: a.profile?.email || '',
            code: a.code,
            status: a.status,
            invites: numInvites,
            activated: activated,
            creditsBalance: creditsBalance,
            totalEarned: totalEarned,
            mesesCanjeados: mesesCanjeados,
            progressPct: progressPct,
            mesesDisponibles: Math.floor(creditsBalance / CREDITS_PER_MONTH),
          };
        });
    }
  });

  const queryClient = useQueryClient();

  // Mutación: aprobar o rechazar afiliado
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'rejected' }) => {
      const { error } = await supabase
        .from('affiliates')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'active' ? 'Afiliado aprobado ✅' : 'Afiliado rechazado');
      queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] });
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const totalEmbajadores = affiliates.length;
  const totalActivaciones = affiliates.reduce((s: number, a: any) => s + a.activated, 0);
  const totalCredits = affiliates.reduce((s: number, a: any) => s + a.creditsBalance, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Afiliados</h1>
            <p className="text-sm text-muted-foreground">Seguimiento de embajadores y referidos</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{totalEmbajadores}</p>
                <p className="text-[11px] text-muted-foreground">Embajadores activos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Gift className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{totalActivaciones}</p>
                <p className="text-[11px] text-muted-foreground">Licencias activadas por referidos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{totalCredits} <span className="text-xs font-normal text-muted-foreground">créditos</span></p>
                <p className="text-[11px] text-muted-foreground">Total créditos disponibles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tabla de Afiliados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase">Embajador</TableHead>
                    <TableHead className="text-[10px] uppercase">Código</TableHead>
                    <TableHead className="text-[10px] uppercase">Estado</TableHead>
                    <TableHead className="text-[10px] uppercase">Invitados</TableHead>
                    <TableHead className="text-[10px] uppercase">Activados</TableHead>
                    <TableHead className="text-[10px] uppercase">Créditos actuales</TableHead>
                    <TableHead className="text-[10px] uppercase">Progreso siguiente mes</TableHead>
                    <TableHead className="text-[10px] uppercase">Meses canjeados</TableHead>
                    <TableHead className="text-[10px] uppercase">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Cargando afiliados...
                      </TableCell>
                    </TableRow>
                  ) : affiliates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                        No hay afiliados registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    affiliates.map((a: any) => (
                      <TableRow key={a.id} className={a.status === 'pending' ? 'bg-amber-500/5 border-l-2 border-amber-500/40' : ''}>
                        {/* Embajador */}
                        <TableCell>
                          <p className="text-xs font-medium text-foreground">{a.name}</p>
                          <p className="text-[11px] text-muted-foreground">{a.email}</p>
                        </TableCell>

                        {/* Código */}
                        <TableCell className="font-mono text-xs text-muted-foreground">{a.code}</TableCell>

                        {/* Estado */}
                        <TableCell>
                          <Badge variant="outline" className={
                            a.status === 'active' ? 'bg-success/15 text-success border-success/30' :
                              a.status === 'pending' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                                'bg-red-500/15 text-red-400 border-red-500/30'
                          }>
                            {a.status === 'active' ? 'Activo' : a.status === 'pending' ? 'Pendiente' : 'Rechazado'}
                          </Badge>
                        </TableCell>

                        {/* Invitados */}
                        <TableCell className="text-xs">{a.invites}</TableCell>

                        {/* Activados */}
                        <TableCell>
                          <Badge variant="outline" className={a.activated > 0 ? "bg-success/15 text-success border-success/30" : "bg-secondary/50 text-muted-foreground"}>
                            {a.activated}
                          </Badge>
                        </TableCell>

                        {/* Créditos disponibles */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm font-bold text-primary">{a.creditsBalance}</span>
                            {a.mesesDisponibles > 0 && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                                {a.mesesDisponibles} mes{a.mesesDisponibles > 1 ? 'es' : ''} listo{a.mesesDisponibles > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Progreso barra */}
                        <TableCell className="min-w-[120px]">
                          <div className="space-y-1">
                            <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${a.progressPct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{a.creditsBalance % 100}/100 créditos</p>
                          </div>
                        </TableCell>

                        {/* Meses ya canjeados */}
                        <TableCell>
                          {a.mesesCanjeados > 0 ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 text-amber-400" />
                              {a.mesesCanjeados} mes{a.mesesCanjeados > 1 ? 'es' : ''}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Acciones: Aprobar / Rechazar si está pending */}
                        <TableCell>
                          {a.status === 'pending' ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateStatus.mutate({ id: a.id, status: 'active' })}
                                disabled={updateStatus.isPending}
                                className="h-7 w-7 rounded-lg bg-success/10 text-success hover:bg-success/20 flex items-center justify-center transition-colors"
                                title="Aprobar"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => updateStatus.mutate({ id: a.id, status: 'rejected' })}
                                disabled={updateStatus.isPending}
                                className="h-7 w-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                                title="Rechazar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAffiliates;

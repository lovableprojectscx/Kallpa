import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const AdminClients = () => {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: async () => {
      // Obtenemos los tenants junto con sus perfiles administradores y sus licencias canjeadas
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          created_at,
          profiles(email, role),
          licenses(code, duration_months, status, redeemed_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedData = data.map((tenant: any) => {
        // Buscar el perfil de admin principal para este gimnasio
        const adminProfile = tenant.profiles?.find((p: any) => p.role === 'admin' || p.role === 'superadmin') || tenant.profiles?.[0];

        // Obtener la licencia activa o más reciente
        // Ordenamos las licencias por fecha de canje descendente
        const tenantLicenses = tenant.licenses || [];
        tenantLicenses.sort((a: any, b: any) =>
          new Date(b.redeemed_at).getTime() - new Date(a.redeemed_at).getTime()
        );
        const currentLicense = tenantLicenses[0];

        // Determinar estado de la licencia (si ha expirado dependiendo de los meses)
        let status = "expired";
        let expirationDate = null;
        if (currentLicense && currentLicense.redeemed_at) {
          const redeemedDate = new Date(currentLicense.redeemed_at);
          expirationDate = new Date(redeemedDate.setMonth(redeemedDate.getMonth() + currentLicense.duration_months));
          if (expirationDate > new Date()) {
            status = "active";
          }
        }

        return {
          id: tenant.id,
          name: tenant.name || "Gimnasio sin nombre",
          email: adminProfile?.email || "Sin correo",
          role: adminProfile?.role || 'user',
          license: currentLicense?.code || "Sin Licencia",
          status: status,
          since: new Date(tenant.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
          referredBy: null // A implementar en módulo de afiliados
        };
      });

      // Filtramos para limpiar la tabla
      return mappedData.filter((c: any) => c.email !== "Sin correo" && c.role !== "superadmin");
    }
  });

  const filtered = clients.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gimnasios que han alojado su sistema en la plataforma</p>
        </motion.div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="Buscar por gimnasio o correo..."
                className="pl-9 h-8 text-xs max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase">Gimnasio</TableHead>
                    <TableHead className="text-[10px] uppercase">Email de Contacto</TableHead>
                    <TableHead className="text-[10px] uppercase">Licencia Actual</TableHead>
                    <TableHead className="text-[10px] uppercase">Estado</TableHead>
                    <TableHead className="text-[10px] uppercase">Registrado</TableHead>
                    <TableHead className="text-[10px] uppercase">Referido por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Cargando clientes...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No hay clientes registrados o que coincidan con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.email}</TableCell>
                        <TableCell className="font-mono text-xs text-primary">{c.license}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={c.status === "active" ? "bg-success/15 text-success border-success/30 px-2 select-none" : "bg-coral/15 text-coral border-coral/30 px-2 select-none"}>
                            {c.status === "active" ? "Activo" : "Sin Licencia/Expirado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.since}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.referredBy || "—"}</TableCell>
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

export default AdminClients;

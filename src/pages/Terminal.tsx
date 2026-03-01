import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Clock, Camera } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

type ScanStatus = "idle" | "approved" | "denied" | "processing";

const Terminal = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [scannedMember, setScannedMember] = useState<{ name: string; info: string } | null>(null);

  const { data: recentCheckins = [] } = useQuery({
    queryKey: ['attendance_recent', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*, members(full_name, status, photo_url)')
        .eq('tenant_id', user.tenantId)
        .order('check_in_time', { ascending: false })
        .limit(5);
      if (error) console.error(error);
      return data || [];
    },
    enabled: !!user?.tenantId,
    refetchInterval: 5000,
  });

  const processScan = useMutation({
    mutationFn: async (qrData: string) => {
      if (!user?.tenantId) throw new Error("No tenant");
      const { data: member, error: memberError } = await supabase
        .from('members').select('*')
        .eq('id', qrData).eq('tenant_id', user.tenantId).single();
      if (memberError || !member) throw new Error("Miembro no encontrado o código inválido");
      if (member.status !== 'active') return { success: false, member, reason: "Membresía Inactiva" };
      if (member.end_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(member.end_date);
        end.setHours(0, 0, 0, 0);
        if (end < today) return { success: false, member, reason: "Membresía Vencida" };
      }
      const { error: attError } = await supabase.from('attendance').insert({
        member_id: member.id, tenant_id: user.tenantId, device_id: 'Principal-Terminal-1'
      });
      if (attError) console.error("Error registrando asistencia:", attError);
      return { success: true, member };
    },
    onMutate: () => setStatus("processing"),
    onSuccess: (result) => {
      if (result.success) {
        setScannedMember({ name: result.member.full_name, info: "Acceso Concedido" });
        setStatus("approved");
        toast.success(`Acceso Aprobado: ${result.member.full_name}`);
      } else {
        setScannedMember({ name: result.member.full_name, info: result.reason! });
        setStatus("denied");
        toast.error(`Acceso Denegado: ${result.member.full_name}`);
      }
      queryClient.invalidateQueries({ queryKey: ['attendance_recent', user?.tenantId] });
      setTimeout(() => { setStatus("idle"); setScannedMember(null); }, 4000);
    },
    onError: (error: any) => {
      setScannedMember({ name: "Desconocido", info: "Código QR Inválido" });
      setStatus("denied");
      toast.error(error.message || "Error procesando el código");
      setTimeout(() => { setStatus("idle"); setScannedMember(null); }, 4000);
    }
  });


  const handleCameraScan = (data: any) => {
    if (data && data[0] && data[0].rawValue && status === "idle") {
      processScan.mutate(data[0].rawValue);
    }
  };

  return (
    <Layout>
      <div className="flex h-full flex-col items-center justify-center p-4">
        {/* Ambient Status Glow */}
        <AnimatePresence>
          {(status === "approved" || status === "denied") && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className={cn(
                "pointer-events-none fixed inset-0 z-50 border-[6px]",
                status === "approved" ? "border-success/60 shadow-[inset_0_0_100px_rgba(34,197,94,0.2)]" : "border-coral/60 shadow-[inset_0_0_100px_rgba(255,107,107,0.2)]"
              )}
            >
              <div className={cn("absolute inset-0", status === "approved" ? "bg-gradient-to-b from-success/5 to-transparent" : "bg-gradient-to-b from-coral/5 to-transparent")} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex w-full max-w-lg flex-col items-center gap-6"
        >
          <div className="text-center">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">Acceso</h1>
            <p className="mt-1 text-sm text-muted-foreground">Presente su código QR digital</p>
          </div>


          {/* QR Scanner Area */}
          <div className={cn(
            "relative flex h-[320px] w-full max-w-[320px] items-center justify-center rounded-[2rem] border-2 transition-all duration-300 overflow-hidden shadow-2xl bg-black",
            status === "idle" ? "border-border" : "",
            status === "processing" ? "border-primary/50 shadow-[0_0_30px_rgba(0,255,200,0.2)]" : "",
            status === "approved" ? "border-success bg-success/10 shadow-[0_0_50px_rgba(34,197,94,0.3)]" : "",
            status === "denied" ? "border-coral bg-coral/10 shadow-[0_0_50px_rgba(255,107,107,0.3)]" : ""
          )}>
            <AnimatePresence mode="wait">
              {status === "idle" && (
                <motion.div key="idle-camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 w-full h-full">
                  <Scanner
                    onScan={handleCameraScan}
                    components={{ finder: false }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                  />
                  {/* Marco guía */}
                  <div className="absolute inset-x-10 inset-y-10 border-2 border-dashed border-primary/60 rounded-xl" />
                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                    <Camera className="h-3 w-3 text-white/50" />
                    <span className="text-[10px] text-white/50">Apunta al código QR</span>
                  </div>
                </motion.div>
              )}

              {status === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium text-primary">Validando Pase...</span>
                </motion.div>
              )}

              {status === "approved" && scannedMember && (
                <motion.div key="approved" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 text-center px-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-white shadow-lg">
                    <Check className="h-10 w-10" />
                  </div>
                  <h2 className="font-display text-2xl text-foreground mt-2">{scannedMember.name}</h2>
                  <span className="text-sm font-medium bg-success/20 text-success px-3 py-1 rounded-full uppercase tracking-wider">{scannedMember.info}</span>
                </motion.div>
              )}

              {status === "denied" && scannedMember && (
                <motion.div key="denied" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 text-center px-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-coral text-white shadow-lg">
                    <X className="h-10 w-10" />
                  </div>
                  <h2 className="font-display text-2xl text-foreground mt-2">{scannedMember.name}</h2>
                  <span className="text-sm font-medium bg-coral/20 text-coral px-3 py-1 rounded-full uppercase tracking-wider">{scannedMember.info}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Historial de Accesos Recientes */}
          <div className="w-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden mt-2 shadow-sm">
            <div className="bg-secondary/40 border-b border-border/50 px-5 py-3.5 flex justify-between items-center">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Actividad Reciente</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 font-medium bg-background px-2 py-1 rounded-md border border-border/30">
                <Clock className="h-3 w-3" />
                EN VIVO
              </div>
            </div>
            <div className="divide-y divide-border/20">
              {recentCheckins.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No hay accesos registrados el día de hoy.
                </div>
              ) : (
                recentCheckins.map((entry: any) => {
                  const isOk = entry.members?.status === 'active';
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      key={entry.id}
                      className="flex items-center justify-between px-5 py-3 bg-card hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {entry.members?.photo_url ? (
                          <img
                            src={entry.members.photo_url}
                            alt={entry.members.full_name}
                            className="h-8 w-8 rounded-lg object-cover shadow-sm ring-1 ring-border/30"
                          />
                        ) : (
                          <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm", isOk ? "bg-success glow-green" : "bg-coral glow-red")} />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{entry.members?.full_name || 'Desconocido'}</span>
                          {!isOk && <span className="text-[10px] text-coral font-semibold uppercase">Acceso Denegado</span>}
                        </div>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                        {format(new Date(entry.check_in_time), "HH:mm")}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Terminal;

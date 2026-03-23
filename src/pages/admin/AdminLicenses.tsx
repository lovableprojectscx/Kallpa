import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Plus, Search, Copy, Loader2, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Precios predeterminados por duración (S/. Soles peruanos)
const DEFAULT_PRICES: Record<number, number> = {
  1: 35,
  3: 89,
  6: 159,
  12: 279,
};

const statusConfig = {
  available: { label: "Disponible", className: "bg-primary/15 text-primary border-primary/30" },
  redeemed: { label: "Canjeada", className: "bg-success/15 text-success border-success/30" },
  expired: { label: "Expirada", className: "bg-coral/15 text-coral border-coral/30" },
};

const AdminLicenses = () => {
  const [search, setSearch] = useState("");
  const [duration, setDuration] = useState("12");
  const [amount, setAmount] = useState("1");
  const [newPrice, setNewPrice] = useState<string>(String(DEFAULT_PRICES[12]));
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Edición inline de precio
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>("");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  /** Sincroniza el precio sugerido en el dialog al cambiar la duración seleccionada. */
  const handleDurationChange = (val: string) => {
    setDuration(val);
    setNewPrice(String(DEFAULT_PRICES[parseInt(val)] || ""));
  };

  /**
   * Obtiene todas las licencias del sistema con su estado y el nombre del tenant que las canjeó.
   * Normaliza los datos para mostrar duración legible, precio formateado y fechas localizadas.
   */
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select(`*, tenant:tenants(name)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((d: any) => ({
        id: d.id,
        code: d.code,
        duration_months: d.duration_months,
        duration: `${d.duration_months} mes${d.duration_months > 1 ? "es" : ""}`,
        status: d.status as "available" | "redeemed" | "expired",
        price_pen: d.price_pen ?? DEFAULT_PRICES[d.duration_months] ?? null,
        label: d.label,
        createdAt: new Date(d.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
        redeemedBy: d.tenant?.name || null,
        redeemedAt: d.redeemed_at ? new Date(d.redeemed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : null,
      }));
    },
  });

  /**
   * Genera uno o más códigos de licencia con el formato `XXXX-XXXX-XXXX-XXXX`.
   * Inserta todos en lote (`licenses.insert`). Máximo 100 por llamada.
   */
  const generateMutation = useMutation({
    mutationFn: async ({ dur, qty, price }: { dur: number; qty: number; price: number }) => {
      if (!user) throw new Error("No autenticado");
      const newLicenses = Array.from({ length: qty }).map(() => {
        const generateRandomBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase().padStart(4, '0');
        const randomCode = `${generateRandomBlock()}-${generateRandomBlock()}-${generateRandomBlock()}-${generateRandomBlock()}`;

        return {
          code: randomCode,
          duration_months: dur,
          status: "available",
          created_by: user.id,
          price_pen: price,
          label: `${dur} mes${dur > 1 ? "es" : ""}`,
        };
      });
      const { error } = await supabase.from("licenses").insert(newLicenses);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licencias generadas con éxito");
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      setIsDialogOpen(false);
      setAmount("1");
      setDuration("12");
      setNewPrice(String(DEFAULT_PRICES[12]));
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  /** Actualiza el `price_pen` de una licencia existente por su código. Solo aplica a licencias 'available'. */
  const updatePriceMutation = useMutation({
    mutationFn: async ({ code, price }: { code: string; price: number }) => {
      const { error } = await supabase
        .from("licenses")
        .update({ price_pen: price })
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Precio actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      setEditingCode(null);
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  /** Valida cantidad (1-100) y precio antes de disparar `generateMutation`. */
  const handleGenerate = () => {
    const qty = parseInt(amount);
    const price = parseFloat(newPrice);
    if (isNaN(qty) || qty < 1 || qty > 100) { toast.error("Cantidad entre 1 y 100"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Ingresa un precio válido"); return; }
    generateMutation.mutate({ dur: parseInt(duration), qty, price });
  };

  /** Activa el modo de edición inline para el precio de una licencia específica. */
  const startEdit = (code: string, currentPrice: number | null) => {
    setEditingCode(code);
    setEditingPrice(String(currentPrice ?? ""));
  };

  /** Confirma la edición inline validando que el precio sea un número positivo. */
  const saveEdit = (code: string) => {
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price <= 0) { toast.error("Precio inválido"); return; }
    updatePriceMutation.mutate({ code, price });
  };

  const filtered = licenses.filter(
    (l: any) =>
      l.code.toLowerCase().includes(search.toLowerCase()) ||
      (l.redeemedBy && l.redeemedBy.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Licencias</h1>
            <p className="text-sm text-muted-foreground">Crea y gestiona códigos de licencia con sus precios</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nueva Licencia
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border/50">
              <DialogHeader>
                <DialogTitle>Crear Licencia</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Select value={duration} onValueChange={handleDurationChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mes</SelectItem>
                      <SelectItem value="3">3 meses</SelectItem>
                      <SelectItem value="6">6 meses</SelectItem>
                      <SelectItem value="12">12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Precio (S/. Soles)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">S/</span>
                    <Input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Precio predeterminado para {duration} mes{parseInt(duration) > 1 ? "es" : ""}: <strong>S/ {DEFAULT_PRICES[parseInt(duration)]}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad a generar</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground">Máximo 100 códigos a la vez.</p>
                </div>

                <Button className="w-full gap-2" onClick={handleGenerate} disabled={generateMutation.isPending}>
                  {generateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Generar Código(s)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Tabla de precios de referencia */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(DEFAULT_PRICES).map(([dur, price]) => (
            <div key={dur} className="rounded-xl border border-border/50 bg-card/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">{dur} mes{parseInt(dur) > 1 ? "es" : ""}</p>
              <p className="text-lg font-black text-foreground font-display">S/ {price}</p>
              <p className="text-[10px] text-muted-foreground">precio base</p>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                placeholder="Buscar por código o cliente..."
                className="pl-9 h-8 text-xs"
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
                    <TableHead className="text-[10px] uppercase">Código</TableHead>
                    <TableHead className="text-[10px] uppercase">Duración</TableHead>
                    <TableHead className="text-[10px] uppercase">Precio S/</TableHead>
                    <TableHead className="text-[10px] uppercase">Estado</TableHead>
                    <TableHead className="text-[10px] uppercase">Creada</TableHead>
                    <TableHead className="text-[10px] uppercase">Canjeado por</TableHead>
                    <TableHead className="text-[10px] uppercase">Fecha Canje</TableHead>
                    <TableHead className="text-[10px] uppercase w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                        Cargando licencias...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No hay licencias que coincidan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((l: any) => {
                      const st = statusConfig[l.status as keyof typeof statusConfig];
                      const isEditing = editingCode === l.code;
                      return (
                        <TableRow key={l.code}>
                          <TableCell className="font-mono text-xs font-medium text-primary">{l.code}</TableCell>
                          <TableCell className="text-xs">{l.duration}</TableCell>

                          {/* Precio editable inline */}
                          <TableCell className="text-xs">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-[11px]">S/</span>
                                <input
                                  autoFocus
                                  type="number"
                                  value={editingPrice}
                                  onChange={(e) => setEditingPrice(e.target.value)}
                                  className="w-20 h-6 text-xs rounded border border-primary/40 bg-secondary/40 px-1.5 focus:outline-none"
                                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(l.code); if (e.key === "Escape") setEditingCode(null); }}
                                />
                                <button onClick={() => saveEdit(l.code)} className="text-green-500 hover:text-green-400">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setEditingCode(null)} className="text-muted-foreground hover:text-foreground">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span className="font-semibold text-foreground">
                                  {l.price_pen != null ? `S/ ${Number(l.price_pen).toFixed(2)}` : "—"}
                                </span>
                                {l.status === "available" && (
                                  <button
                                    onClick={() => startEdit(l.code, l.price_pen)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.createdAt}</TableCell>
                          <TableCell className="text-xs font-medium">{l.redeemedBy || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.redeemedAt || "—"}</TableCell>
                          <TableCell>
                            {l.status === "available" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => { navigator.clipboard.writeText(l.code); toast.success("Código copiado"); }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
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

export default AdminLicenses;

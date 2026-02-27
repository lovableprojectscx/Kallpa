import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Globe, Bell, Shield,
  Instagram, Facebook, Clock, Key, Loader2, Users, MessageCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Staff from "./Staff";

const Settings = () => {
  const { user, logout } = useAuth();
  const { hasActiveSubscription, expirationDate, redeemMembershipCode, checkSubscription } = useSubscription();
  const queryClient = useQueryClient();

  // License State
  const [licenseCode, setLicenseCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Form States (Gimnasio)
  const [gymName, setGymName] = useState("");
  const [gymEmail, setGymEmail] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [gymWhatsApp, setGymWhatsApp] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymTimeZone, setGymTimeZone] = useState("America/Bogota");
  const [gymInstagram, setGymInstagram] = useState("");
  const [gymFacebook, setGymFacebook] = useState("");
  const [gymWeb, setGymWeb] = useState("");

  // Schedule State
  const defaultSchedule = [
    { day: "Lunes", openTime: "06:00", closeTime: "22:00", isOpen: true },
    { day: "Martes", openTime: "06:00", closeTime: "22:00", isOpen: true },
    { day: "Miércoles", openTime: "06:00", closeTime: "22:00", isOpen: true },
    { day: "Jueves", openTime: "06:00", closeTime: "22:00", isOpen: true },
    { day: "Viernes", openTime: "06:00", closeTime: "22:00", isOpen: true },
    { day: "Sábado", openTime: "08:00", closeTime: "18:00", isOpen: true },
    { day: "Domingo", openTime: "00:00", closeTime: "00:00", isOpen: false }
  ];
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // DB Fetch
  const { data: tenantData, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['tenant_settings', user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      const { data: tenant, error: tenError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.tenantId)
        .single();

      if (tenError) {
        console.error("Error fetching tenant:", tenError);
        throw tenError;
      }

      let { data: settings, error: setE } = await supabase
        .from('gym_settings')
        .select('*')
        .eq('tenant_id', user.tenantId)
        .single();

      if (setE && setE.code === 'PGRST116') {
        const { data: newSettings, error: insertE } = await supabase
          .from('gym_settings')
          .insert({
            tenant_id: user.tenantId,
            gym_name: tenant?.name || 'Mi Gimnasio'
          })
          .select().single();

        if (insertE) {
          console.error("Error creating gym_settings:", insertE);
          throw insertE;
        }
        settings = newSettings;
      } else if (setE) {
        console.error("Error fetching gym_settings:", setE);
        throw setE;
      }
      return { tenant, settings };
    },
    enabled: !!user?.tenantId,
    retry: 1
  });

  // Effect to load data
  useEffect(() => {
    if (tenantData) {
      setGymName(tenantData.tenant?.name || "");
      setGymEmail(tenantData.settings?.contact_email || "");
      setGymPhone(tenantData.settings?.contact_phone || "");
      setGymWhatsApp(tenantData.settings?.whatsapp_number || "");
      setGymAddress(tenantData.settings?.address || "");
      setGymTimeZone(tenantData.settings?.timezone || "America/Bogota");

      const social = tenantData.settings?.social_media || {};
      setGymInstagram(social.instagram || "");
      setGymFacebook(social.facebook || "");
      setGymWeb(social.website || "");

      if (tenantData.settings?.operating_hours) {
        setSchedule(tenantData.settings.operating_hours);
      }
    }
  }, [tenantData]);

  // Mutations
  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!user?.tenantId) throw new Error("No Tenant");
      await supabase.from('tenants').update({ name: gymName }).eq('id', user.tenantId);
      const { error } = await supabase.from('gym_settings').update({
        contact_email: gymEmail,
        contact_phone: gymPhone,
        whatsapp_number: gymWhatsApp,
        address: gymAddress,
        timezone: gymTimeZone,
        social_media: { instagram: gymInstagram, facebook: gymFacebook, website: gymWeb },
        operating_hours: schedule
      }).eq('tenant_id', user.tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
      setIsEditingSchedule(false);
      toast.success("Configuración actualizada correctamente");
    },
    onError: (e: any) => {
      toast.error("Error al guardar: " + e.message);
    }
  });

  const handleRedeem = async () => {
    if (!licenseCode.trim()) {
      toast.error("Ingresa un código válido");
      return;
    }
    setIsRedeeming(true);
    const success = await redeemMembershipCode(licenseCode.trim());
    if (success) {
      toast.success("¡Licencia canjeada con éxito!");
      setLicenseCode("");
    } else {
      toast.error("El código no es válido o ya fue canjeado");
    }
    setIsRedeeming(false);
  };

  const handleBuyLicense = async (months: number, price: number) => {
    if (!user?.tenantId) return;
    setIsRedeeming(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference-v3', {
        body: {
          planDuration: months,
          pricePen: price,
          tenantId: user.tenantId,
          bypassAuth: "confirm_bypass_kallpa_2024"
        }
      });

      if (error) {
        let detail = "";
        try {
          const errorData = await error.context?.json();
          detail = errorData?.detail || errorData?.error || "";
        } catch (e) { }
        throw new Error(detail || error.message || "Error desconocido");
      }

      if (data?.init_point) {
        // Redirigir a Mercado Pago
        window.location.href = data.init_point;
      } else {
        throw new Error("No se pudo iniciar el proceso de pago.");
      }
    } catch (err: any) {
      toast.error("Error de conexión: " + err.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Cargando configuraciones...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-coral">
          <p className="text-xl font-bold">Error cargando configuraciones</p>
          <p className="text-sm border border-coral/30 bg-coral/10 p-4 rounded-xl max-w-lg text-center">
            {(queryError as Error)?.message || "Error al conectar con la base de datos."}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
            Reintentar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row justify-between sm:items-end gap-4"
        >
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground tracking-tight">Configuraciones del Sistema</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Conectado al Workspace seguro ID: <span className="font-mono bg-secondary px-2 rounded-sm text-foreground">{user?.tenantId?.split('-')[0] || 'Unknown'}</span>
            </p>
          </div>
          <Button
            onClick={() => updateSettings.mutate()}
            disabled={updateSettings.isPending}
            className="bg-primary text-primary-foreground hover:opacity-90 shadow-lg glow-volt min-w-[140px]"
          >
            {updateSettings.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : "Guardar Cambios"}
          </Button>
        </motion.div>

        <Tabs defaultValue="gym" className="space-y-6">
          <TabsList className="bg-secondary/40 p-1 border border-border/50 rounded-xl w-full sm:w-auto h-auto flex flex-wrap sm:flex-nowrap gap-1">
            <TabsTrigger value="gym" className="flex-1 sm:flex-none rounded-lg py-2 px-2 sm:px-4 text-[10px] sm:text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Building2 className="h-3.5 w-3.5 mr-1 sm:mr-2" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex-1 sm:flex-none rounded-lg py-2 px-2 sm:px-4 text-[10px] sm:text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5 mr-1 sm:mr-2" /> Personal
            </TabsTrigger>
            <TabsTrigger value="license" className="flex-1 sm:flex-none rounded-lg py-2 px-2 sm:px-4 text-[10px] sm:text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Shield className="h-3.5 w-3.5 mr-1 sm:mr-2" /> Licencia
            </TabsTrigger>
            <TabsTrigger value="notifications" className="hidden sm:flex flex-none rounded-lg py-2 px-2 sm:px-4 text-[10px] sm:text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Bell className="h-3.5 w-3.5 mr-1 sm:mr-2" /> Alertas
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 sm:flex-none rounded-lg py-2 px-2 sm:px-4 text-[10px] sm:text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Key className="h-3.5 w-3.5 mr-1 sm:mr-2" /> Seguridad
            </TabsTrigger>
          </TabsList>


          {/* GIMNASIO */}
          <TabsContent value="gym" className="space-y-4 focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="border-border/50 bg-card/50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">Detalles del Negocio</CardTitle>
                      <CardDescription>Esta info aparecerá en los recibos y portal de clientes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="g-name" className="text-primary font-semibold">Nombre de tu Gimnasio *</Label>
                        <Input id="g-name" value={gymName} onChange={e => setGymName(e.target.value)} className="bg-secondary/20 font-bold" />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="g-mail">Email Público</Label>
                          <Input id="g-mail" value={gymEmail} onChange={e => setGymEmail(e.target.value)} className="bg-secondary/20" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="g-phone">Teléfono Recepción</Label>
                          <Input id="g-phone" value={gymPhone} onChange={e => setGymPhone(e.target.value)} className="bg-secondary/20" />
                        </div>
                      </div>
                      {/* WhatsApp del Gym */}
                      <div className="space-y-2">
                        <Label htmlFor="g-wa" className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                          WhatsApp del Gimnasio
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">(con código de país, ej: 51987654321)</span>
                        </Label>
                        <Input
                          id="g-wa"
                          value={gymWhatsApp}
                          onChange={e => setGymWhatsApp(e.target.value)}
                          placeholder="51987654321"
                          className="bg-secondary/20 font-mono"
                        />
                        <p className="text-xs text-muted-foreground">Este número aparece en el Portal del Miembro para que puedan contactarte y renovar.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="g-addr">Dirección Exacta</Label>
                        <Input id="g-addr" value={gymAddress} onChange={e => setGymAddress(e.target.value)} placeholder="Ej. Av Libertad 123..." className="bg-secondary/20" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="g-tz">Zona Horaria (Timezone)</Label>
                        <Select value={gymTimeZone} onValueChange={setGymTimeZone}>
                          <SelectTrigger className="bg-secondary/20 h-10">
                            <SelectValue placeholder="Selecciona una zona horaria" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="America/Bogota">Bogotá / Lima / Quito (UTC-5)</SelectItem>
                            <SelectItem value="America/Buenos_Aires">Buenos Aires (UTC-3)</SelectItem>
                            <SelectItem value="America/Caracas">Caracas (UTC-4)</SelectItem>
                            <SelectItem value="America/Guatemala">Guatemala / Centroamérica (UTC-6)</SelectItem>
                            <SelectItem value="America/Mexico_City">Ciudad de México (UTC-6)</SelectItem>
                            <SelectItem value="America/Montevideo">Montevideo (UTC-3)</SelectItem>
                            <SelectItem value="America/New_York">Nueva York / Miami (UTC-5)</SelectItem>
                            <SelectItem value="America/Santiago">Santiago (UTC-3)</SelectItem>
                            <SelectItem value="Europe/Madrid">Madrid (UTC+1 / UTC+2)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/50 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-2 text-primary">
                        <Globe className="h-4 w-4" />
                        <CardTitle className="text-lg">Redes Sociales</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2"><Instagram className="h-3.5 w-3.5" /> Instagram Username</Label>
                          <Input value={gymInstagram} onChange={e => setGymInstagram(e.target.value)} placeholder="@gym" className="bg-secondary/20" />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2"><Facebook className="h-3.5 w-3.5" /> Facebook Page</Label>
                          <Input value={gymFacebook} onChange={e => setGymFacebook(e.target.value)} placeholder="fb.com/gym" className="bg-secondary/20" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Sitio Web Oficial</Label>
                        <Input value={gymWeb} onChange={e => setGymWeb(e.target.value)} placeholder="https://..." className="bg-secondary/20" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/50 bg-card/50 shadow-sm h-fit">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Horario de Operación
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditingSchedule ? (
                      <div className="space-y-3">
                        {schedule.map((item, idx) => (
                          <div key={idx} className="flex flex-col gap-2 pb-3 border-b border-border/50 last:border-0">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{item.day}</span>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground mr-1">Apertura</Label>
                                <Switch
                                  checked={item.isOpen}
                                  onCheckedChange={(val) => {
                                    const newSched = [...schedule];
                                    newSched[idx].isOpen = val;
                                    setSchedule(newSched);
                                  }}
                                />
                              </div>
                            </div>
                            {item.isOpen && (
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="time"
                                  value={item.openTime}
                                  onChange={(e) => {
                                    const newSched = [...schedule];
                                    newSched[idx].openTime = e.target.value;
                                    setSchedule(newSched);
                                  }}
                                  className="bg-secondary/20 h-8 text-xs"
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                  type="time"
                                  value={item.closeTime}
                                  onChange={(e) => {
                                    const newSched = [...schedule];
                                    newSched[idx].closeTime = e.target.value;
                                    setSchedule(newSched);
                                  }}
                                  className="bg-secondary/20 h-8 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingSchedule(false);
                              if (tenantData?.settings?.operating_hours) {
                                setSchedule(tenantData.settings.operating_hours);
                              }
                            }}
                            className="w-full text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={() => updateSettings.mutate()}
                            disabled={updateSettings.isPending}
                            className="w-full text-xs"
                          >
                            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Horario"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {schedule.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-0 pb-2 last:pb-0">
                            <span className="text-muted-foreground font-medium">{item.day}</span>
                            <span className={`text-foreground ${!item.isOpen && 'text-muted-foreground italic'}`}>
                              {item.isOpen ? `${item.openTime} - ${item.closeTime}` : 'Cerrado'}
                            </span>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          onClick={() => setIsEditingSchedule(true)}
                          className="w-full text-xs mt-2 uppercase tracking-widest text-primary hover:bg-primary/10 border-dashed border border-primary/20"
                        >
                          Personalizar horarios
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* PERSONAL / STAFF */}
          <TabsContent value="staff" className="space-y-4 focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Staff />
            </motion.div>
          </TabsContent>

          {/* LICENCIA */}
          <TabsContent value="license" className="space-y-4 focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid gap-6 md:grid-cols-5">
              <Card className="md:col-span-3 border-border/50 bg-card/50 shadow-sm h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Suscripción SaaS Activa</CardTitle>
                  <CardDescription>Manejo de licencias del local en KALLPA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`relative overflow-hidden rounded-2xl p-6 border shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] ${hasActiveSubscription ? 'bg-gradient-to-br from-success/20 to-success/5 border-success/30' : 'bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/30'}`}>
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <p className={`text-[10px] uppercase tracking-[0.2em] font-bold mb-1 ${hasActiveSubscription ? 'text-success' : 'text-destructive'}`}>Status Licencia</p>
                        <h3 className="text-3xl font-display font-bold text-foreground">
                          {hasActiveSubscription ? 'Operativo' : (user?.role === 'superadmin' ? 'Vitalicio (Master)' : 'Vencido / Inactivo')}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-2">
                          {user?.role === 'superadmin'
                            ? 'Licencia de propietario global. Sin expiración.'
                            : hasActiveSubscription && expirationDate
                              ? <>Válida hasta el <span className="text-foreground font-bold font-mono">{expirationDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span></>
                              : 'Debes canjear un código de licencia para operar de forma ilimitada.'
                          }
                        </p>
                      </div>
                      <Shield className={`h-14 w-14 drop-shadow-md ${hasActiveSubscription ? 'text-success/60' : 'text-destructive/60'}`} />
                    </div>
                    <div className={`absolute top-0 right-0 w-32 h-32 blur-[50px] -mr-10 -mt-10 ${hasActiveSubscription ? 'bg-success/20' : 'bg-destructive/20'}`} />
                  </div>

                  <div className="space-y-3 p-4 bg-secondary/30 rounded-xl border border-border/50">
                    <Label>¿Tienes una clave de activación o de suscripción?</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ej. A3B9-X8K1-P0M2-Q7R4"
                        value={licenseCode}
                        onChange={(e) => setLicenseCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase bg-card"
                      />
                      <Button
                        onClick={handleRedeem}
                        disabled={isRedeeming || !licenseCode}
                        className="bg-foreground text-background hover:bg-foreground/80 min-w-[100px]"
                      >
                        {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Canjear Código"}
                      </Button>
                    </div>

                    <div className="pt-4 mt-6 border-t border-border/50">
                      <Label className="text-base font-semibold mb-4 block">Comprar o Renovar Licencia</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                          onClick={() => handleBuyLicense(1, 49)} // 1 Mes = S/ 49
                          disabled={isRedeeming}
                          className="w-full bg-[#009EE3] text-white hover:bg-[#0089C5] shadow-lg flex items-center justify-between px-4 py-8 h-auto"
                        >
                          <div className="text-left">
                            <p className="font-bold text-lg">1 Mes</p>
                            <p className="text-xs text-white/80">{hasActiveSubscription ? "Renovación mensual" : "Suscripción mensual"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-xl">S/ 49</p>
                            <p className="text-[10px] text-white/70 uppercase">
                              {hasActiveSubscription ? "Renovar ahora" : "Comprar ahora"}
                            </p>
                          </div>
                        </Button>

                        <Button
                          onClick={() => handleBuyLicense(12, 490)} // 1 Año = S/ 490 (Ahorro)
                          disabled={isRedeeming}
                          className="w-full bg-[#009EE3] text-white hover:bg-[#0089C5] shadow-lg flex items-center justify-between px-4 py-8 h-auto relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">AHORRA 17%</div>
                          <div className="text-left">
                            <p className="font-bold text-lg">1 Año</p>
                            <p className="text-xs text-white/80">{hasActiveSubscription ? "Renovación anual" : "Suscripción anual"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-xl">S/ 490</p>
                            <p className="text-[10px] text-white/70 uppercase">
                              {hasActiveSubscription ? "Renovar ahora" : "Comprar ahora"}
                            </p>
                          </div>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4 text-center">Pagos procesados de forma segura a través de Mercado Pago.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* SEGURIDAD */}
          <TabsContent value="security" className="space-y-4 focus-visible:outline-none">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid gap-6 sm:grid-cols-2">
                <Card className="border-destructive/30 bg-card/50 shadow-sm overflow-hidden h-fit">
                  <CardHeader className="bg-destructive/5 pb-4 border-b border-destructive/20">
                    <CardTitle className="text-lg text-destructive">Cierre Temporal / Cuentas</CardTitle>
                    <CardDescription>Acciones de control de sesión</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    <div className="space-y-2">
                      <Label className="text-foreground">Cerrar Sesión en Todos los Dispositivos</Label>
                      <p className="text-xs text-muted-foreground mb-4">Finaliza el acceso a tu cuenta en TODOS los navegadores, computadoras y celulares donde hayas iniciado sesión simultáneamente.</p>
                      <Button variant="outline" onClick={logout} className="w-full border-border/50 text-foreground hover:bg-secondary">
                        Cerrar Sesión Global
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications">
            <div className="p-12 text-center text-muted-foreground border border-border/50 rounded-2xl bg-card/50 border-dashed">
              <Bell className="h-8 w-8 mx-auto mb-4 opacity-50" />
              Centro de Notificaciones en las Rutas de Próximas Actualizaciones.
            </div>
          </TabsContent>


        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;

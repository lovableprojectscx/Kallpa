import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import SubscriptionGuard from "./components/SubscriptionGuard";
import AdminGuard from "./components/AdminGuard";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Terminal from "./pages/Terminal";
import Members from "./pages/Members";
import Affiliate from "./pages/Affiliate";
import Subscription from "./pages/Subscription";
import Retention from "./pages/Retention";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLicenses from "./pages/admin/AdminLicenses";
import AdminClients from "./pages/admin/AdminClients";
import AdminAffiliates from "./pages/admin/AdminAffiliates";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";
import CarnetPublico from "./pages/CarnetPublico";
import PortalBusqueda from "./pages/PortalBusqueda";
import PortalMiembro from "./pages/PortalMiembro";
import Recepcion from "./pages/Recepcion";
import LoginRecepcion from "./pages/LoginRecepcion";
import AceptarInvitacion from "./pages/AceptarInvitacion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
              {/* Recepción — login propio para staff */}
              <Route path="/recepcion/login" element={<LoginRecepcion />} />
              {/* Aceptar invitación de staff */}
              <Route path="/recepcion/aceptar" element={<AceptarInvitacion />} />
              {/* Terminal de Recepción */}
              <Route path="/recepcion" element={<AuthGuard><Recepcion /></AuthGuard>} />
              {/* Rutas públicas — sin autenticación */}
              <Route path="/" element={<Landing />} />
              <Route path="/carnet/:memberId" element={<CarnetPublico />} />
              <Route path="/portal" element={<PortalBusqueda />} />
              <Route path="/portal/:memberId" element={<PortalMiembro />} />
              <Route
                path="*"
                element={
                  <AuthGuard>
                    <SubscriptionGuard>
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/terminal" element={<Terminal />} />
                        <Route path="/members" element={<Members />} />
                        <Route path="/subscription" element={<Subscription />} />
                        <Route path="/affiliate" element={<Affiliate />} />
                        <Route path="/retention" element={<Retention />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/plans" element={<Plans />} />
                        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                        <Route path="/admin/licenses" element={<AdminGuard><AdminLicenses /></AdminGuard>} />
                        <Route path="/admin/clients" element={<AdminGuard><AdminClients /></AdminGuard>} />
                        <Route path="/admin/affiliates" element={<AdminGuard><AdminAffiliates /></AdminGuard>} />
                        <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </SubscriptionGuard>
                  </AuthGuard>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </QueryClientProvider>
);



export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import SubscriptionGuard from "./components/SubscriptionGuard";
import AdminGuard from "./components/AdminGuard";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Terminal from "./pages/Terminal";
import Members from "./pages/Members";
import Affiliate from "./pages/Affiliate";
import Subscription from "./pages/Subscription";
import Retention from "./pages/Retention";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import Classes from "./pages/Classes";
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
import AceptarInvitacion from "./pages/AceptarInvitacion";
import Payments from "./pages/Payments";
import GymPublica from "./pages/GymPublica";

/**
 * Envuelve todas las rutas del panel autenticado (admin/dashboard).
 * Aplica en orden: AuthGuard → SubscriptionGuard → Layout.
 * - AuthGuard verifica sesión y redirige por rol.
 * - SubscriptionGuard bloquea si el tenant no tiene suscripción activa.
 * - Layout renderiza la sidebar + contenido via <Outlet />.
 */
const AuthenticatedLayoutArea = () => (
  <AuthGuard>
    <SubscriptionGuard>
      <Layout>
        <Outlet />
      </Layout>
    </SubscriptionGuard>
  </AuthGuard>
);

/**
 * Cliente de TanStack Query con configuración global:
 * - refetchOnWindowFocus desactivado para no generar requests al cambiar de tab.
 * - retry=1 para reintentar una sola vez en caso de error de red.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Árbol de providers y rutas de la aplicación.
 *
 * Jerarquía de providers (orden importa):
 *   QueryClientProvider → BrowserRouter → AuthProvider → SubscriptionProvider
 *
 * SubscriptionProvider necesita estar dentro de BrowserRouter porque usa
 * useNavigate() internamente (requireSubscription navega a /subscription).
 *
 * Grupos de rutas:
 * - Públicas: /, /login, /register, /forgot-password, /update-password,
 *             /carnet/:memberId, /portal, /portal/:memberId
 * - Recepción: /recepcion (maneja su propio auth de staff)
 * - Autenticadas: envueltas en AuthenticatedLayoutArea
 * - Admin: dentro de AuthenticatedLayoutArea + AdminGuard adicional
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<ResetPassword />} />
              <Route path="/carnet/:memberId" element={<CarnetPublico />} />
              <Route path="/portal" element={<PortalBusqueda />} />
              <Route path="/portal/:memberId" element={<PortalMiembro />} />
              <Route path="/g/:slug" element={<GymPublica />} />

              {/* Onboarding — requiere auth pero no suscripción */}
              <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />

              {/* Recepción — maneja su propio estado de autenticación de staff */}
              <Route path="/recepcion/login" element={<Navigate to="/recepcion" replace />} />
              <Route path="/recepcion/aceptar" element={<AceptarInvitacion />} />
              <Route path="/recepcion" element={<Recepcion />} />

              {/* Rutas autenticadas con sidebar */}
              <Route element={<AuthenticatedLayoutArea />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/members" element={<Members />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/affiliate" element={<Affiliate />} />
                <Route path="/retention" element={<Retention />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/classes" element={<Classes />} />
                <Route path="/payments" element={<Payments />} />

                {/* Panel superadmin — protegido por AdminGuard adicional */}
                <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                <Route path="/admin/licenses" element={<AdminGuard><AdminLicenses /></AdminGuard>} />
                <Route path="/admin/clients" element={<AdminGuard><AdminClients /></AdminGuard>} />
                <Route path="/admin/affiliates" element={<AdminGuard><AdminAffiliates /></AdminGuard>} />
                <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

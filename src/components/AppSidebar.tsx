import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ScanLine,
  Users,
  CreditCard,
  Bell,
  Settings,
  Gift,
  Tags,
  LogOut,
  CalendarDays,
  Banknote,
} from "lucide-react";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Terminal", url: "/terminal", icon: ScanLine },
  { title: "Miembros", url: "/members", icon: Users },
  { title: "Planes", url: "/plans", icon: Tags },
  { title: "Clases", url: "/classes", icon: CalendarDays },
  { title: "Retención", url: "/retention", icon: Bell },
  { title: "Pagos", url: "/payments", icon: Banknote },
];

const secondaryNav = [
  { title: "Planes PRO", url: "/subscription", icon: CreditCard },
  { title: "Afiliados", url: "/affiliate", icon: Gift },
  { title: "Ajustes", url: "/settings", icon: Settings },
];


/**
 * Barra lateral de navegación para el panel del administrador de gimnasio.
 * Divide los ítems en dos grupos:
 * - `mainNav`: rutas principales (Dashboard, Terminal, Miembros, Planes, Retención).
 * - `secondaryNav`: rutas secundarias (Planes PRO, Afiliados, Ajustes) + botón Cerrar Sesión.
 * Usa `NavLink` personalizado que aplica `activeClassName` según la ruta activa.
 */
export function AppSidebar() {
  const { logout } = useAuth();

  return (
    <Sidebar className="border-r border-border/50">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Kallpa" className="h-full w-full object-contain drop-shadow-sm glow-volt" />
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm tracking-tight text-foreground">KALLPA</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Pro Suite</span>
        </div>
      </div>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary glow-volt"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={logout}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}


import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
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
  KeyRound,
  Users,
  Gift,
  Settings,
  ShieldCheck,
  LogOut
} from "lucide-react";

const mainNav = [
  { title: "Panel", url: "/admin", icon: LayoutDashboard },
  { title: "Licencias", url: "/admin/licenses", icon: KeyRound },
  { title: "Clientes", url: "/admin/clients", icon: Users },
  { title: "Afiliados", url: "/admin/affiliates", icon: Gift },
];

const secondaryNav = [
  { title: "Config Admin", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { logout } = useAuth();

  return (
    <Sidebar className="border-r border-border/50">
      <Link to="/admin" className="flex items-center gap-3 px-5 py-6 transition-opacity hover:opacity-80">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Kallpa Admin" className="h-full w-full object-contain drop-shadow-sm glow-red" />
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm tracking-tight text-foreground">KALLPA</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-coral">Admin</span>
        </div>
      </Link>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
                      activeClassName="bg-coral/10 text-coral"
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
                      activeClassName="bg-coral/10 text-coral"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => logout()}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

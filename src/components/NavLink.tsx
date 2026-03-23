import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

/**
 * Wrapper sobre `NavLink` de React Router que acepta `className` como string simple
 * en lugar de la función `({ isActive }) => string` del API nativo.
 * Aplica `activeClassName` cuando la ruta está activa y `pendingClassName`
 * durante la transición (Suspense/lazy loading).
 * Compatible con `SidebarMenuButton asChild` de shadcn/ui.
 */
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };

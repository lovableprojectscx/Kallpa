import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  /** positive = verde, negative = rojo, neutral = gris, warning = ámbar */
  accent?: "positive" | "negative" | "warning" | "neutral";
}

const accentStyles = {
  positive: { wrap: "border-emerald-500/20 bg-emerald-500/5", icon: "bg-emerald-500/15 text-emerald-400", value: "text-foreground" },
  negative: { wrap: "border-red-500/20 bg-red-500/5",       icon: "bg-red-500/15 text-red-400",       value: "text-red-400" },
  warning:  { wrap: "border-amber-500/20 bg-amber-500/5",   icon: "bg-amber-500/15 text-amber-400",   value: "text-foreground" },
  neutral:  { wrap: "border-border/40 bg-card",             icon: "bg-secondary/60 text-muted-foreground", value: "text-foreground" },
};

/**
 * Tarjeta de métrica minimalista.
 * Solo muestra lo esencial: título, número principal, subtítulo e ícono.
 * Sin badges de tendencia ni etiquetas adicionales que confundan.
 */
export function StatCard({ title, value, subtitle, icon: Icon, accent = "neutral" }: StatCardProps) {
  const s = accentStyles[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md",
        s.wrap
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
          {title}
        </p>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", s.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className={cn("text-2xl sm:text-3xl font-bold tracking-tight leading-none", s.value)}>
        {value}
      </p>

      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{subtitle}</p>
      )}
    </motion.div>
  );
}

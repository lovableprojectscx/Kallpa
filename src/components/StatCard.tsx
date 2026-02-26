import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon, subtitle }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="group rounded-xl border border-border/50 bg-card p-5 transition-smooth hover:border-border"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
          <span className="stat-number text-3xl text-foreground">{value}</span>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-smooth group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {change && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-semibold",
              changeType === "positive" && "text-primary",
              changeType === "negative" && "text-coral",
              changeType === "neutral" && "text-muted-foreground"
            )}
          >
            {change}
          </span>
          <span className="text-xs text-muted-foreground">vs. mes anterior</span>
        </div>
      )}
    </motion.div>
  );
}

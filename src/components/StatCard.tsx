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
      className="group rounded-xl border border-border/50 bg-card p-3 sm:p-5 transition-smooth hover:border-border"
    >
      <div className="flex items-start justify-between gap-1 sm:gap-0">
        <div className="flex flex-col gap-0.5 sm:gap-1 w-full overflow-hidden">
          <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate" title={title}>{title}</span>
          <span className="stat-number text-xl sm:text-3xl text-foreground truncate" title={value}>{value}</span>
          {subtitle && <span className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 sm:truncate" title={subtitle}>{subtitle}</span>}
        </div>
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-smooth group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
      {change && (
        <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-1.5 flex-wrap">
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

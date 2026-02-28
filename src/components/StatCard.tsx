import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
  comparisonLabel?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon, subtitle, comparisonLabel }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="group rounded-2xl border border-border/40 bg-card p-3 sm:p-4 transition-smooth hover:border-border hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 w-full overflow-hidden">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground/70" title={title}>{title}</span>
          <div className="flex items-baseline gap-2">
            <span className="stat-number text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight" title={value}>{value}</span>
          </div>
          {subtitle && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground/60 font-medium leading-tight" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-secondary/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
        </div>
      </div>

      {change !== undefined && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
            changeType === "positive" && "bg-primary/10 text-primary",
            changeType === "negative" && "bg-coral/10 text-coral",
            changeType === "neutral" && "bg-secondary text-muted-foreground"
          )}>
            {changeType === "positive" && <TrendingUp className="h-3 w-3" />}
            {changeType === "negative" && <TrendingDown className="h-3 w-3" />}
            {change}
          </div>
          {comparisonLabel && (
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
              {comparisonLabel}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

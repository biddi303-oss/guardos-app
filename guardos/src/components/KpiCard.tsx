import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "default" | "primary" | "warning" | "danger" | "success";
  className?: string;
}

const ACCENTS: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  warning: "text-amber-400",
  danger: "text-rose-400",
  success: "text-emerald-400",
};

export function KpiCard({ label, value, hint, icon, accent = "default", className }: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-border/60 bg-card/60 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className={cn("text-2xl font-semibold tabular-nums", ACCENTS[accent])}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && (
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        )}
      </div>
    </Card>
  );
}

import { AlertTriangle, MapPin, Siren, Clock, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/db";

const TYPE_META: Record<Alert["type"], { icon: typeof AlertTriangle; tone: string; label: string }> = {
  "missed-checkpoint": { icon: AlertTriangle, tone: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "MISSED"         },
  "sos":               { icon: Siren,         tone: "text-rose-400 bg-rose-500/10 border-rose-500/40",   label: "SOS"            },
  "geofence-breach":   { icon: MapPin,        tone: "text-rose-400 bg-rose-500/10 border-rose-500/40",   label: "LEFT ZONE"      },
  "inactive":          { icon: Clock,         tone: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "INACTIVE"      },
  "shift-start":       { icon: Shield,        tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "SHIFT START" },
  "shift-end":         { icon: Shield,        tone: "text-zinc-300 bg-zinc-500/10 border-zinc-500/30",   label: "SHIFT END"      },
  "checkpoint":        { icon: CheckCircle2,  tone: "text-primary bg-primary/10 border-primary/30",      label: "CHECKPOINT"     },
};

export function AlertTypeChip({ type, className }: { type: Alert["type"]; className?: string }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono tracking-wider whitespace-nowrap",
        meta.tone,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

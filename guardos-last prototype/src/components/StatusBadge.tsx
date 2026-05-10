import { cn } from "@/lib/utils";
import type { GuardStatus } from "@/lib/db";

const STATUS_STYLES: Record<GuardStatus, { dot: string; text: string; bg: string; label: string }> = {
  "on-duty": {
    dot:   "bg-emerald-400",
    text:  "text-emerald-300",
    bg:    "bg-emerald-500/10 border-emerald-500/30",
    label: "ON DUTY",
  },
  "on-patrol": {
    dot:   "bg-emerald-400",
    text:  "text-emerald-300",
    bg:    "bg-emerald-500/10 border-emerald-500/30",
    label: "ON PATROL",
  },
  idle: {
    dot:   "bg-sky-400",
    text:  "text-sky-300",
    bg:    "bg-sky-500/10 border-sky-500/30",
    label: "IDLE",
  },
  responding: {
    dot:   "bg-violet-400",
    text:  "text-violet-300",
    bg:    "bg-violet-500/10 border-violet-500/30",
    label: "RESPONDING",
  },
  "off-duty": {
    dot:   "bg-zinc-500",
    text:  "text-zinc-400",
    bg:    "bg-zinc-500/10 border-zinc-500/30",
    label: "OFF DUTY",
  },
  alert: {
    dot:   "bg-rose-400",
    text:  "text-rose-300",
    bg:    "bg-rose-500/10 border-rose-500/40",
    label: "ALERT",
  },
  "out-of-zone": {
    dot:   "bg-orange-400",
    text:  "text-orange-300",
    bg:    "bg-orange-500/10 border-orange-500/40",
    label: "OUT OF ZONE",
  },
};

interface StatusBadgeProps {
  status: GuardStatus;
  pulse?: boolean;
  className?: string;
  label?: string;
}

export function StatusBadge({ status, pulse, className, label }: StatusBadgeProps) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono tracking-wider",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {(pulse ?? status === "alert") && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", s.dot)} />
        )}
        <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", s.dot)} />
      </span>
      {label ?? s.label}
    </span>
  );
}

/**
 * Shared popup components used by both Admin and Client portals.
 *
 * AlertPopup  — compact modal shown when an alert row is clicked
 * GuardPopup  — guard details modal shown when a guard row is clicked
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Clock, Shield, Siren, AlertTriangle,
  CheckCircle2, Navigation, Activity, ExternalLink,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getSites, type Guard, type Alert } from "@/lib/db";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict } from "date-fns";

// ── Shared helpers ────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "warning" | "info";

function alertSeverity(type: Alert["type"]): AlertSeverity {
  if (type === "sos" || type === "geofence-breach") return "critical";
  if (type === "missed-checkpoint" || type === "inactive") return "warning";
  return "info";
}

function alertLabel(type: Alert["type"]): string {
  if (type === "sos")               return "SOS";
  if (type === "geofence-breach")   return "Left Zone";
  if (type === "missed-checkpoint") return "Missed Patrol";
  if (type === "inactive")          return "Inactive";
  if (type === "shift-start")       return "Shift Start";
  if (type === "shift-end")         return "Shift End";
  return "Checkpoint";
}

function statusColor(status: Guard["status"]) {
  if (status === "alert")       return "text-rose-400";
  if (status === "out-of-zone") return "text-orange-400";
  if (status === "on-duty" || status === "on-patrol") return "text-emerald-400";
  if (status === "idle")        return "text-sky-400";
  if (status === "responding")  return "text-violet-400";
  return "text-zinc-400";
}

function statusDot(status: Guard["status"]) {
  if (status === "alert")       return "bg-rose-400 animate-ping";
  if (status === "out-of-zone") return "bg-orange-400 animate-pulse";
  if (status === "on-duty" || status === "on-patrol") return "bg-emerald-400 animate-pulse";
  if (status === "idle")        return "bg-sky-400";
  if (status === "responding")  return "bg-violet-400 animate-pulse";
  return "bg-zinc-500";
}

// ── Backdrop + modal shell ────────────────────────────────────────────────────

function PopupShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key="popup-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          key="popup-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
          className="w-full max-w-sm bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── AlertPopup ────────────────────────────────────────────────────────────────

export interface AlertPopupProps {
  alert: Alert;
  onClose: () => void;
}

export function AlertPopup({ alert: a, onClose }: AlertPopupProps) {
  const guards = useAppStore((s) => s.guards);
  const guard  = guards.find((g) => g.id === a.guardId);
  const site   = getSites().find((s) => s.id === a.siteId);
  const sev    = alertSeverity(a.type);

  const sevBorder = sev === "critical" ? "border-rose-500/50" : sev === "warning" ? "border-amber-500/40" : "border-border/60";
  const sevBg     = sev === "critical" ? "bg-rose-500/8"      : sev === "warning" ? "bg-amber-500/5"      : "";
  const sevText   = sev === "critical" ? "text-rose-400"      : sev === "warning" ? "text-amber-400"      : "text-primary";
  const sevIcon   = sev === "critical"
    ? <Siren className="h-5 w-5 text-rose-400" />
    : sev === "warning"
    ? <AlertTriangle className="h-5 w-5 text-amber-400" />
    : <CheckCircle2 className="h-5 w-5 text-primary" />;

  return (
    <PopupShell onClose={onClose}>
      {/* Header */}
      <div className={cn("px-4 py-3 border-b flex items-center gap-3", sevBorder, sevBg)}>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {sevIcon}
          <span className={cn("text-sm font-semibold uppercase tracking-wide", sevText)}>
            {alertLabel(a.type)}
          </span>
          {!a.read && (
            <span className="ml-auto px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-mono uppercase tracking-wider flex-shrink-0">
              New
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {/* Guard name + status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">{a.guardName.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{a.guardName}</div>
            <div className="text-[10px] font-mono text-muted-foreground">{a.guardDisplayId}</div>
          </div>
          {guard && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={cn("h-2 w-2 rounded-full", statusDot(guard.status))} />
              <span className={cn("text-[10px] font-mono uppercase", statusColor(guard.status))}>
                {guard.status.replace(/-/g, " ")}
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Details grid */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Message</div>
              <div className="text-foreground/90 leading-snug">{a.message}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Location</div>
              <div className="text-foreground/90">{site?.name ?? a.siteId}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Time</div>
              <div className="text-foreground/90 font-mono text-[11px]">
                {format(new Date(a.timestamp), "MMM d · HH:mm:ss")}
                <span className="text-muted-foreground ml-2">
                  {formatDistanceToNowStrict(new Date(a.timestamp), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <button
          onClick={onClose}
          className="w-full h-9 rounded-lg border border-border/60 bg-card/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          Close
        </button>
      </div>
    </PopupShell>
  );
}

// ── GuardPopup ────────────────────────────────────────────────────────────────

export interface GuardPopupProps {
  guard: Guard;
  onClose: () => void;
  /** Called when "See on Map" is clicked — should focus the map on this guard */
  onSeeOnMap?: (guardId: string) => void;
}

export function GuardPopup({ guard: g, onClose, onSeeOnMap }: GuardPopupProps) {
  const allAlerts      = useAppStore((s) => s.alerts);
  const guardPositions = useAppStore((s) => s.guardPositions);
  const site           = getSites().find((s) => s.id === g.siteId);
  const pos            = guardPositions[g.id];

  // Last 3 alerts for this guard
  const recentAlerts = useMemo(() =>
    allAlerts
      .filter((a) => a.guardId === g.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3),
    [allAlerts, g.id],
  );

  const activityIcon = () => {
    if (g.activity === "alert")     return <Siren className="h-3.5 w-3.5 text-rose-400" />;
    if (g.activity === "patrol")    return <Navigation className="h-3.5 w-3.5 text-primary" />;
    if (g.activity === "responding") return <Shield className="h-3.5 w-3.5 text-violet-400" />;
    return <Activity className="h-3.5 w-3.5 text-zinc-400" />;
  };

  const handleSeeOnMap = () => {
    onClose();
    onSeeOnMap?.(g.id);
  };

  return (
    <PopupShell onClose={onClose}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3">
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{g.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{g.name}</div>
            <div className="text-[10px] font-mono text-muted-foreground">{g.guardId}</div>
          </div>
        </div>
        {/* Live status dot */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={cn("h-2 w-2 rounded-full", statusDot(g.status))} />
          <span className={cn("text-[10px] font-mono uppercase", statusColor(g.status))}>
            {g.status.replace(/-/g, " ")}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto max-h-[60vh]">
        <div className="px-4 py-4 space-y-4">

          {/* ── Details ─────────────────────────────────────────────── */}
          <div className="space-y-0 rounded-xl border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 bg-card/40">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Location</span>
              <span className="text-xs font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {site?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Activity</span>
              <span className="text-xs flex items-center gap-1.5 capitalize">
                {activityIcon()}
                {g.activity ?? "patrol"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Last movement</span>
              <span className="text-xs font-mono">
                {formatDistanceToNowStrict(new Date(g.lastActivity), { addSuffix: true })}
              </span>
            </div>
            {g.shiftStart && (
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Shift started</span>
                <span className="text-xs font-mono">{format(new Date(g.shiftStart), "HH:mm")}</span>
              </div>
            )}
            <div className="px-3 py-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Last action</div>
              <div className="text-xs text-foreground/80 leading-snug">{g.lastActivityLabel}</div>
            </div>
          </div>

          {/* ── Position ────────────────────────────────────────────── */}
          {pos && (
            <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5 flex items-center gap-2">
              <Navigation className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Position</div>
                <div className="text-[11px] font-mono text-foreground/80 truncate">
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                  {pos.accuracy ? <span className="text-muted-foreground ml-2">±{Math.round(pos.accuracy)}m</span> : null}
                </div>
              </div>
              <span className={cn("text-[9px] font-mono uppercase flex-shrink-0", pos.source === "gps" ? "text-emerald-400" : "text-amber-400")}>
                {pos.source === "gps" ? "GPS" : "SIM"}
              </span>
            </div>
          )}

          {/* ── Recent alerts ────────────────────────────────────────── */}
          {recentAlerts.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Alerts</div>
              <div className="space-y-1.5">
                {recentAlerts.map((a) => {
                  const sev = alertSeverity(a.type);
                  return (
                    <div key={a.id} className={cn(
                      "flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs",
                      sev === "critical" ? "border-rose-500/30 bg-rose-500/5" :
                      sev === "warning"  ? "border-amber-500/30 bg-amber-500/5" :
                                           "border-border/60 bg-card/40",
                    )}>
                      <div className={cn("h-1.5 w-1.5 rounded-full mt-1 flex-shrink-0",
                        sev === "critical" ? "bg-rose-400" : sev === "warning" ? "bg-amber-400" : "bg-primary")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[10px] font-mono uppercase font-semibold",
                            sev === "critical" ? "text-rose-400" : sev === "warning" ? "text-amber-400" : "text-primary")}>
                            {alertLabel(a.type)}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatDistanceToNowStrict(new Date(a.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-muted-foreground leading-snug mt-0.5 truncate">{a.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-border/60 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-9 rounded-lg border border-border/60 bg-card/60 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          Close
        </button>
        {onSeeOnMap && (
          <button
            onClick={handleSeeOnMap}
            className="flex-1 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            See on Map
          </button>
        )}
      </div>
    </PopupShell>
  );
}

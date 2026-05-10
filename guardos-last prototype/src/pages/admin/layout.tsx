import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Bell, LogOut, MapPin, Clock, CheckCircle2,
  AlertTriangle, Siren, X, ChevronRight, LayoutDashboard,
  ClipboardList, Maximize2, Activity, Navigation, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { getSites, type Guard, type Alert } from "@/lib/db";
import { GuardMap } from "@/components/GuardMap";
import { AlertPopup, GuardPopup } from "@/components/GuardPopup";
import { getGeofenceById } from "@/lib/geofence";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict } from "date-fns";

type Tab = "dashboard" | "guards" | "logs" | "alerts";

const NAV: { key: Tab; href: string; label: string; icon: typeof Shield }[] = [
  { key: "dashboard", href: "/admin",         label: "Dashboard", icon: LayoutDashboard },
  { key: "guards",    href: "/admin/guards",   label: "Guards",    icon: Users           },
  { key: "logs",      href: "/admin/logs",     label: "Logs",      icon: ClipboardList   },
  { key: "alerts",    href: "/admin/alerts",   label: "Alerts",    icon: Bell            },
];

// ─── Alert helpers ────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "warning" | "info";

function alertSeverity(type: Alert["type"]): AlertSeverity {
  if (type === "sos" || type === "geofence-breach") return "critical";
  if (type === "missed-checkpoint" || type === "inactive") return "warning";
  return "info";
}

function AlertIcon({ type }: { type: Alert["type"] }) {
  if (type === "sos")               return <Siren className="h-4 w-4 text-rose-400" />;
  if (type === "geofence-breach")   return <MapPin className="h-4 w-4 text-rose-400" />;
  if (type === "missed-checkpoint") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  if (type === "inactive")          return <Clock className="h-4 w-4 text-amber-400" />;
  if (type === "shift-start")       return <Shield className="h-4 w-4 text-emerald-400" />;
  if (type === "shift-end")         return <Shield className="h-4 w-4 text-zinc-400" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
}

function alertTone(type: Alert["type"]) {
  const sev = alertSeverity(type);
  if (sev === "critical") return "border-rose-500/50 bg-rose-500/8";
  if (sev === "warning")  return "border-amber-500/40 bg-amber-500/5";
  return "border-border/60 bg-card/40";
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

// ─── Guard status badge ───────────────────────────────────────────────────────

function GuardStatusBadge({ guard }: { guard: Guard }) {
  if (guard.status === "alert") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-[10px] font-mono text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping absolute" />
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 relative" />
        ALERT
      </span>
    );
  }
  if (guard.status === "out-of-zone") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-[10px] font-mono text-orange-300">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
        OUT OF ZONE
      </span>
    );
  }
  if (guard.status === "on-duty" || guard.status === "on-patrol") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-mono text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ON DUTY
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-zinc-500/40 bg-zinc-500/10 text-[10px] font-mono text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      OFF DUTY
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ tab }: { tab: Tab }) {
  const [, setLocation] = useLocation();
  const logout = useAppStore((s) => s.logout);
  const alerts = useAppStore((s) => s.alerts);
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <aside className="hidden md:flex w-52 flex-col border-r border-border/60 bg-sidebar">
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-border/60">
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold">GuardOS</span>
        <Badge variant="outline" className="ml-auto font-mono text-[9px] border-primary/30 text-primary">OPS</Badge>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((it) => {
          const active = tab === it.key;
          const Icon = it.icon;
          return (
            <Link key={it.key} href={it.href}
              className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground border border-border/60"
                       : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground")}>
              <Icon className="h-4 w-4" />
              {it.label}
              {it.key === "alerts" && unread > 0 && (
                <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono flex items-center justify-center">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border/60">
        <button onClick={() => { logout(); setLocation("/"); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ title }: { title: string }) {
  const alerts = useAppStore((s) => s.alerts);
  const unread = alerts.filter((a) => !a.read).length;
  return (
    <div className="h-14 px-4 md:px-6 border-b border-border/60 flex items-center gap-3 bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="text-base font-semibold flex-1">{title}</div>
      <Link href="/admin/alerts">
        <button className="relative h-8 w-8 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center hover:bg-card transition-colors">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </Link>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const guards         = useAppStore((s) => s.guards);
  const alerts         = useAppStore((s) => s.alerts);
  const markAlertRead  = useAppStore((s) => s.markAlertRead);

  const onDuty   = guards.filter((g) => g.status !== "off-duty").length;
  const offDuty  = guards.filter((g) => g.status === "off-duty").length;
  const alerting = guards.filter((g) => g.status === "alert" || g.status === "out-of-zone").length;
  const unread   = alerts.filter((a) => !a.read);

  const [mapOpen,         setMapOpen]         = useState(false);
  const [selectedFenceId, setSelectedFenceId] = useState<string | null>(null);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [panelSearch,     setPanelSearch]     = useState("");
  const [alertPopup,      setAlertPopup]      = useState<(typeof unread)[number] | null>(null);
  const [guardPopup,      setGuardPopup]      = useState<Guard | null>(null);
  const mapCardRef = useRef<HTMLDivElement>(null);

  const locationGuards = useMemo(() => {
    if (!selectedFenceId) return [];
    return guards.filter((g) => g.geofenceId === selectedFenceId);
  }, [guards, selectedFenceId]);

  const selectedFence = selectedFenceId ? getGeofenceById(selectedFenceId) : null;
  const selectedGuard = selectedGuardId ? guards.find((g) => g.id === selectedGuardId) : null;

  const handleLocationClick = (fenceId: string) => { setSelectedFenceId(fenceId); setSelectedGuardId(null); setPanelSearch(""); };
  const handleGuardClick    = (guardId: string)  => {
    setSelectedGuardId(guardId);
    const g = guards.find((x) => x.id === guardId);
    if (g) setSelectedFenceId(g.geofenceId);
  };
  const closePanel = () => { setSelectedFenceId(null); setSelectedGuardId(null); setPanelSearch(""); };

  const handleAlertClick = (a: (typeof unread)[number]) => {
    setAlertPopup(a);
  };

  const handleAlertSeeOnMap = (a: (typeof unread)[number]) => {
    markAlertRead(a.id);
    handleGuardClick(a.guardId);
    mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    if (!mapOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setMapOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mapOpen]);

  const activityIcon = (g: Guard) => {
    const act = g.activity;
    if (act === "alert")  return <Siren className="h-3.5 w-3.5 text-rose-400" />;
    if (act === "patrol") return <Navigation className="h-3.5 w-3.5 text-primary" />;
    return <Activity className="h-3.5 w-3.5 text-zinc-400" />;
  };

  const MapContent = ({ fs = false }: { fs?: boolean }) => (
    <div className={cn("flex", fs ? "h-full" : "h-[340px]")}>
      <div className="flex-1 min-w-0 relative">
        <GuardMap fullscreen={fs} height={fs ? undefined : 340}
          highlightGuardId={selectedGuardId}
          onLocationClick={handleLocationClick}
          onGuardClick={handleGuardClick} />
        {!selectedFenceId && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="bg-background/80 border border-border/60 text-[11px] font-mono text-muted-foreground px-3 py-1.5 rounded-full backdrop-blur">
              Click a location to see guards
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedFenceId && (
          <motion.div key="side-panel"
            initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="flex-shrink-0 border-l border-border/60 bg-background/95 backdrop-blur overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border/60 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{selectedFence?.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {locationGuards.filter(g => g.status !== "off-duty").length} on duty · {locationGuards.length} total
                </div>
              </div>
              <button onClick={closePanel} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!selectedGuard ? (
                <div className="divide-y divide-border/60">
                  {/* Search bar */}
                  {locationGuards.length > 0 && (
                    <div className="px-3 py-2 border-b border-border/60">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search guards…"
                          value={panelSearch}
                          onChange={(e) => setPanelSearch(e.target.value)}
                          className="w-full h-8 pl-8 pr-3 rounded-md border border-border/60 bg-card/60 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                        />
                        {panelSearch && (
                          <button onClick={() => setPanelSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const q = panelSearch.trim().toLowerCase();
                    const visible = q
                      ? locationGuards.filter((g) => g.name.toLowerCase().includes(q) || g.guardId.toLowerCase().includes(q))
                      : locationGuards;
                    if (locationGuards.length === 0) return <p className="px-4 py-6 text-xs text-muted-foreground text-center">No guards assigned.</p>;
                    if (visible.length === 0) return <p className="px-4 py-6 text-xs text-muted-foreground text-center">No guards found.</p>;
                    return visible.map((g) => (
                    <button key={g.id} onClick={() => setSelectedGuardId(g.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-card/60 transition-colors text-left">
                      <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0",
                        g.status === "alert"       ? "bg-rose-400 animate-ping" :
                        g.status === "out-of-zone" ? "bg-orange-400 animate-pulse" :
                        g.status !== "off-duty"    ? "bg-emerald-400" : "bg-zinc-500")} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{g.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{g.guardId}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    </button>
                  ));
                  })()}
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <button onClick={() => setSelectedGuardId(null)}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground">
                    ← Back to list
                  </button>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-3 w-3 rounded-full flex-shrink-0",
                      selectedGuard.status === "alert"       ? "bg-rose-400 animate-ping" :
                      selectedGuard.status === "out-of-zone" ? "bg-orange-400 animate-pulse" :
                      selectedGuard.status !== "off-duty"    ? "bg-emerald-400" : "bg-zinc-500")} />
                    <div>
                      <div className="text-sm font-semibold">{selectedGuard.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{selectedGuard.guardId}</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-border/60">
                      <span className="text-muted-foreground">Status</span>
                      <span className={cn("font-mono uppercase text-[10px]",
                        selectedGuard.status === "alert"       ? "text-rose-400" :
                        selectedGuard.status === "out-of-zone" ? "text-orange-400" :
                        selectedGuard.status !== "off-duty"    ? "text-emerald-400" : "text-zinc-400")}>
                        {selectedGuard.status.replace(/-/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/60">
                      <span className="text-muted-foreground">Activity</span>
                      <span className="flex items-center gap-1.5 font-mono text-[10px] capitalize">
                        {activityIcon(selectedGuard)}
                        {selectedGuard.activity ?? "patrol"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/60">
                      <span className="text-muted-foreground">Last movement</span>
                      <span className="font-mono text-[10px]">
                        {formatDistanceToNowStrict(selectedGuard.lastActivity, { addSuffix: true })}
                      </span>
                    </div>
                    {selectedGuard.shiftStart && (
                      <div className="flex items-center justify-between py-2 border-b border-border/60">
                        <span className="text-muted-foreground">Shift started</span>
                        <span className="font-mono text-[10px]">{format(selectedGuard.shiftStart, "HH:mm")}</span>
                      </div>
                    )}
                    <div className="pt-1">
                      <div className="text-muted-foreground mb-1">Last action</div>
                      <div className="text-foreground/80 leading-snug">{selectedGuard.lastActivityLabel}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Alert popup */}
      {alertPopup && (
        <AlertPopup
          alert={alertPopup}
          onClose={() => setAlertPopup(null)}
        />
      )}
      {/* Guard popup */}
      {guardPopup && (
        <GuardPopup
          guard={guardPopup}
          onClose={() => setGuardPopup(null)}
          onSeeOnMap={(id) => {
            handleGuardClick(id);
            mapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        />
      )}
      <AnimatePresence>
        {mapOpen && (
          <>
            <motion.div key="map-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setMapOpen(false)} />
            <motion.div key="map-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-4 md:inset-8 z-50 flex flex-col rounded-2xl overflow-hidden border border-border/60 shadow-2xl bg-background">
              <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-background/95 backdrop-blur flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Live Guard Map</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{guards.filter(g => g.status !== "off-duty").length} active</span>
                </div>
                <button onClick={() => setMapOpen(false)}
                  className="h-8 w-8 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0"><MapContent fs /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-border/60 bg-card/60 text-center">
          <div className="text-2xl font-bold text-emerald-400">{onDuty}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">On Duty</div>
        </Card>
        <Card className="p-4 border-border/60 bg-card/60 text-center">
          <div className="text-2xl font-bold text-zinc-400">{offDuty}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Off Duty</div>
        </Card>
        <Card className={cn("p-4 border-border/60 text-center", alerting > 0 ? "bg-rose-500/10 border-rose-500/40" : "bg-card/60")}>
          <div className={cn("text-2xl font-bold", alerting > 0 ? "text-rose-400" : "text-foreground")}>{alerting}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">Alerts</div>
        </Card>
      </div>

      <Card ref={mapCardRef} className="border-border/60 bg-card/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <span className="text-sm font-semibold">Live Guard Map</span>
          <button onClick={() => setMapOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card hover:border-primary/40 transition-colors">
            <Maximize2 className="h-3.5 w-3.5" /> Open Map
          </button>
        </div>
        <MapContent />
      </Card>

      {unread.length > 0 && (
        <Card className="border-border/60 bg-card/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-semibold">Active Alerts</span>
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-mono flex items-center justify-center">{unread.length}</span>
            </div>
            <Link href="/admin/alerts">
              <button className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
                All <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
          <div className="divide-y divide-border/60">
            {unread.slice(0, 6).map((a) => {
              const site = getSites().find((s) => s.id === a.siteId);
              return (
                <div key={a.id} onClick={() => handleAlertClick(a)}
                  className={cn("px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors hover:brightness-110", alertTone(a.type))}>                  <div className="flex-shrink-0 mt-0.5"><AlertIcon type={a.type} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={cn("text-[10px] font-mono uppercase tracking-wider font-semibold",
                        alertSeverity(a.type) === "critical" ? "text-rose-400" :
                        alertSeverity(a.type) === "warning"  ? "text-amber-400" : "text-primary")}>
                        {alertLabel(a.type)}
                      </span>
                      <span className="text-xs font-medium text-foreground">{a.guardName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-snug">{a.message}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{site?.name ?? a.siteId}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(a.timestamp, "HH:mm:ss")} · {formatDistanceToNowStrict(a.timestamp, { addSuffix: true })}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); markAlertRead(a.id); }}
                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5" title="Dismiss">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="border-border/60 bg-card/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="text-sm font-semibold">Guard Roster</div>
          <Link href="/admin/guards">
            <button className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">All <ChevronRight className="h-3 w-3" /></button>
          </Link>
        </div>
        <div className="divide-y divide-border/60">
          {guards.slice(0, 6).map((g) => {
            const site = getSites().find((s) => s.id === g.siteId);
            return (
              <button
                key={g.id}
                onClick={() => setGuardPopup(g)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-card/60 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{g.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{g.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{g.guardId} · {site?.name}</div>
                </div>
                <GuardStatusBadge guard={g} />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Guards page ──────────────────────────────────────────────────────────────

function GuardsPage() {
  const guards = useAppStore((s) => s.guards);
  const [filter, setFilter] = useState<"all" | "on-duty" | "off-duty" | "alert">("all");
  const [search, setSearch] = useState("");
  const [guardPopup, setGuardPopup] = useState<Guard | null>(null);

  const filtered = useMemo(() => {
    const byStatus = filter === "all" ? guards : guards.filter((g) => g.status === filter);
    const q = search.trim().toLowerCase();
    return q ? byStatus.filter((g) => g.name.toLowerCase().includes(q) || g.guardId.toLowerCase().includes(q)) : byStatus;
  }, [guards, filter, search]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {guardPopup && (
        <GuardPopup guard={guardPopup} onClose={() => setGuardPopup(null)} />
      )}
      {/* Search + filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-9 rounded-lg border border-border/60 bg-card/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "on-duty", "off-duty", "alert"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-wider transition-colors",
                filter === f ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card")}>
              {f === "all" ? `All (${guards.length})` : f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map((g) => {
          const site = getSites().find((s) => s.id === g.siteId);
          return (
            <Card
              key={g.id}
              onClick={() => setGuardPopup(g)}
              className={cn("p-4 border-border/60 bg-card/60 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-colors", g.status === "alert" && "border-rose-500/40 bg-rose-500/5")}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{g.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{g.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{g.guardId}</span>
                    <GuardStatusBadge guard={g} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /><span className="truncate">{site?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="truncate">{g.lastActivityLabel}</span>
                    <span className="ml-auto font-mono flex-shrink-0">{formatDistanceToNowStrict(g.lastActivity, { addSuffix: true })}</span>
                  </div>
                  {g.onDuty && g.shiftStart && (
                    <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                      Shift started {format(g.shiftStart, "HH:mm")} · {formatDistanceToNowStrict(g.shiftStart)} ago
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{search ? "No guards found." : "No guards match this filter."}</p>}
      </div>
    </div>
  );
}

// ─── Logs page ────────────────────────────────────────────────────────────────

function LogsPage() {
  const patrolLogs = useAppStore((s) => s.patrolLogs);

  return (
    <div className="p-4 md:p-6">
      <Card className="border-border/60 bg-card/60 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border/60 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Guard</div>
          <div className="col-span-4">Checkpoint</div>
          <div className="col-span-3 text-right">Status</div>
        </div>
        {patrolLogs.length === 0 && (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">No patrol logs yet.</div>
        )}
        {patrolLogs.slice(0, 50).map((log) => (
          <div key={log.id} className="grid grid-cols-12 px-4 py-3 border-b border-border/60 items-center text-sm last:border-0">
            <div className="col-span-2 text-[11px] font-mono text-muted-foreground tabular-nums">{format(new Date(log.timestamp), "HH:mm")}</div>
            <div className="col-span-3 min-w-0">
              <div className="text-xs font-medium truncate">{log.guardName}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{log.guardDisplayId}</div>
            </div>
            <div className="col-span-4 text-xs truncate">{log.checkpointName}</div>
            <div className="col-span-3 text-right">
              {log.status === "verified" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> OK
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono border-amber-500/40 bg-amber-500/10 text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> MISSED
                </span>
              )}
              {log.pendingSync && <div className="text-[9px] font-mono text-amber-400/70 mt-0.5">pending</div>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Alerts page ──────────────────────────────────────────────────────────────

function AlertsPage() {
  const alerts            = useAppStore((s) => s.alerts);
  const markAlertRead     = useAppStore((s) => s.markAlertRead);
  const markAllAlertsRead = useAppStore((s) => s.markAllAlertsRead);
  const [filter, setFilter] = useState<"all" | "unread" | "critical" | "warning">("all");
  const [alertPopup, setAlertPopup] = useState<Alert | null>(null);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === "unread")   return !a.read;
      if (filter === "critical") return alertSeverity(a.type) === "critical";
      if (filter === "warning")  return alertSeverity(a.type) === "warning";
      return true;
    });
  }, [alerts, filter]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {alertPopup && (
        <AlertPopup alert={alertPopup} onClose={() => setAlertPopup(null)} />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["all", "unread", "critical", "warning"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-wider transition-colors",
                filter === f
                  ? f === "critical" ? "bg-rose-500/15 border-rose-500/50 text-rose-300"
                  : f === "warning"  ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                  : "bg-primary/10 border-primary/40 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card")}>
              {f === "all" ? `All (${alerts.length})` : f === "unread" ? `Unread (${unreadCount})` : f}
            </button>
          ))}
        </div>
        {unreadCount > 0 && <Button variant="secondary" size="sm" onClick={markAllAlertsRead}>Mark all read</Button>}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No alerts.</p>}
        {filtered.map((a) => {
          const site = getSites().find((s) => s.id === a.siteId);
          const sev  = alertSeverity(a.type);
          return (
            <div
              key={a.id}
              onClick={() => setAlertPopup(a)}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-colors cursor-pointer hover:brightness-105",
                alertTone(a.type),
                !a.read && sev === "critical" && "ring-1 ring-inset ring-rose-500/30",
                !a.read && sev === "warning"  && "ring-1 ring-inset ring-amber-500/20",
              )}
            >
              <div className="flex-shrink-0 mt-0.5"><AlertIcon type={a.type} /></div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-mono uppercase tracking-wider font-bold",
                    sev === "critical" ? "text-rose-400" : sev === "warning" ? "text-amber-400" : "text-primary")}>
                    {alertLabel(a.type)}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{a.guardName}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.guardDisplayId}</span>
                  {!a.read && <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-mono uppercase tracking-wider">New</span>}
                </div>
                <div className="text-sm text-foreground/80 leading-snug">{a.message}</div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{site?.name ?? a.siteId}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(a.timestamp, "MMM d · HH:mm:ss")}</span>
                  <span>{formatDistanceToNowStrict(a.timestamp, { addSuffix: true })}</span>
                </div>
              </div>
              {!a.read && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAlertRead(a.id); }}
                  className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card flex-shrink-0 mt-0.5 transition-colors"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const role = useAppStore((s) => s.role);
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ tab?: string }>("/admin/:tab");
  const tab = (match ? params.tab : "dashboard") as Tab;

  useEffect(() => {
    if (role !== "admin") setLocation("/admin/login");
  }, [role, setLocation]);

  const titles: Record<Tab, string> = {
    dashboard: "Dashboard", guards: "Guards", logs: "Patrol Logs", alerts: "Alerts",
  };

  return (
    <div className="flex h-[calc(100vh-0px)] bg-background">
      <Sidebar tab={tab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={titles[tab] ?? "Dashboard"} />
        <div className="md:hidden flex border-b border-border/60 bg-background/80 backdrop-blur overflow-x-auto">
          {NAV.map((it) => {
            const active = tab === it.key;
            const Icon = it.icon;
            return (
              <Link key={it.key} href={it.href}
                className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-mono uppercase tracking-wider transition-colors min-w-[60px]",
                  active ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}>
                <Icon className="h-4 w-4" />{it.label}
              </Link>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === "dashboard" && <Dashboard />}
              {tab === "guards"    && <GuardsPage />}
              {tab === "logs"      && <LogsPage />}
              {tab === "alerts"    && <AlertsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

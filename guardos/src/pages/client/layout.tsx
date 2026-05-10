import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, LogOut, Shield, MapPin, Clock,
  CheckCircle2, AlertTriangle, LayoutDashboard,
  ClipboardList, Map, Maximize2, X, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { getSites, getClients, type Guard } from "@/lib/db";
import { getGeofencesForSite } from "@/lib/geofence";
import { GuardMap } from "@/components/GuardMap";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict } from "date-fns";

type Tab = "overview" | "logs";

const NAV: { key: Tab; href: string; label: string; icon: typeof Shield }[] = [
  { key: "overview", href: "/client",      label: "Overview", icon: LayoutDashboard },
  { key: "logs",     href: "/client/logs", label: "Logs",     icon: ClipboardList   },
];

function useActiveClient() {
  const userId = useAppStore((s) => s.userId);
  return useMemo(() => {
    const clients = getClients();
    return clients.find((c) => c.id === userId) ?? clients[0];
  }, [userId]);
}

// ── Status badge covering all GuardStatus values ──────────────────────────────
function GuardStatusBadge({ guard }: { guard: Guard }) {
  const s = guard.status;
  if (s === "alert") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-[10px] font-mono text-rose-300">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
      ALERT
    </span>
  );
  if (s === "out-of-zone") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-[10px] font-mono text-orange-300">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
      OUT OF ZONE
    </span>
  );
  if (s === "on-patrol" || s === "on-duty") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-mono text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      ON PATROL
    </span>
  );
  if (s === "idle") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-[10px] font-mono text-sky-300">
      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
      IDLE
    </span>
  );
  if (s === "responding") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-[10px] font-mono text-violet-300">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
      RESPONDING
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-zinc-500/40 bg-zinc-500/10 text-[10px] font-mono text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      OFF DUTY
    </span>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview() {
  const client     = useActiveClient();
  const allGuards  = useAppStore((s) => s.guards);
  const site       = getSites().find((s) => s.id === client.siteId);
  const fence      = getGeofencesForSite(client.siteId)[0]; // primary geofence for this site

  // Only guards assigned to this client's site
  const siteGuards = allGuards.filter((g) => g.siteId === client.siteId);
  const onDuty     = siteGuards.filter((g) => g.status !== "off-duty").length;
  const alerting   = siteGuards.filter((g) => g.status === "alert" || g.status === "out-of-zone").length;
  const offDuty    = siteGuards.filter((g) => g.status === "off-duty").length;

  const [mapOpen, setMapOpen] = useState(false);
  const [mapFocusGuardId, setMapFocusGuardId] = useState<string | null>(null);
  const [guardSearch, setGuardSearch] = useState("");

  const visibleGuards = useMemo(() => {
    const q = guardSearch.trim().toLowerCase();
    return q ? siteGuards.filter((g) => g.name.toLowerCase().includes(q) || g.guardId.toLowerCase().includes(q)) : siteGuards;
  }, [siteGuards, guardSearch]);

  // Escape closes fullscreen map
  useEffect(() => {
    if (!mapOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setMapOpen(false); setMapFocusGuardId(null); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mapOpen]);

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* ── Fullscreen map overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {mapOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => { setMapOpen(false); setMapFocusGuardId(null); }}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-4 md:inset-8 z-50 flex flex-col rounded-2xl overflow-hidden border border-border/60 shadow-2xl bg-background"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-background/95 backdrop-blur flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{site?.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {onDuty} active
                  </span>
                </div>
                <button
                  onClick={() => { setMapOpen(false); setMapFocusGuardId(null); }}
                  className="h-8 w-8 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <GuardMap fullscreen onlySiteId={client.siteId} highlightGuardId={mapFocusGuardId} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Location header ────────────────────────────────────────────── */}
      <Card className="p-4 border-border/60 bg-card/60">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold truncate">{site?.name ?? "Your Location"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {site?.address}
            </div>
            {fence && (
              <div className="text-[10px] font-mono text-muted-foreground mt-1">
                Geofence: {fence.name}
              </div>
            )}
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono text-[9px] flex-shrink-0"
          >
            MONITORED
          </Badge>
        </div>
      </Card>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-border/60 bg-card/60 text-center">
          <div className="text-2xl font-bold text-emerald-400">{onDuty}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">On Site</div>
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

      {/* ── Map preview ────────────────────────────────────────────────── */}
      <Card className="border-border/60 bg-card/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <span className="text-sm font-semibold">Live Map — {site?.name}</span>
          <button
            onClick={() => setMapOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card hover:border-primary/40 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Open Map
          </button>
        </div>
        <div
          className="relative cursor-pointer group"
          onClick={() => setMapOpen(true)}
          role="button"
          aria-label="Open full screen map"
        >
          <GuardMap height={240} onlySiteId={client.siteId} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border/60 text-xs font-medium px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5">
              <Maximize2 className="h-3.5 w-3.5" /> Open full screen
            </span>
          </div>
        </div>
      </Card>

      {/* ── Guard list ─────────────────────────────────────────────────── */}
      <Card className="border-border/60 bg-card/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="text-sm font-semibold">Guards at {site?.name}</div>
          <span className="text-[10px] font-mono text-muted-foreground">{siteGuards.length} assigned</span>
        </div>
        {/* Search bar */}
        <div className="px-4 py-2.5 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name…"
              value={guardSearch}
              onChange={(e) => setGuardSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-8 rounded-md border border-border/60 bg-card/60 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
            {guardSearch && (
              <button onClick={() => setGuardSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {siteGuards.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No guards assigned to this location.
            </div>
          )}
          {siteGuards.length > 0 && visibleGuards.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No guards found.
            </div>
          )}
          {visibleGuards.map((g) => (
            <button
              key={g.id}
              onClick={() => { setMapFocusGuardId(g.id); setMapOpen(true); }}
              className={cn(
                "w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-card/60 transition-colors",
                (g.status === "alert" || g.status === "out-of-zone") && "bg-rose-500/5",
              )}
            >
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{g.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{g.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span className="truncate">{g.lastActivityLabel}</span>
                  <span className="ml-auto flex-shrink-0">
                    {formatDistanceToNowStrict(g.lastActivity, { addSuffix: true })}
                  </span>
                </div>
              </div>
              <GuardStatusBadge guard={g} />            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function LogsPage() {
  const client     = useActiveClient();
  const patrolLogs = useAppStore((s) => s.patrolLogs);
  const siteLogs   = patrolLogs.filter((l) => l.siteId === client.siteId);
  const site       = getSites().find((s) => s.id === client.siteId);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-sm text-muted-foreground">
        Patrol logs for <span className="font-medium text-foreground">{site?.name}</span>
      </div>

      <Card className="border-border/60 bg-card/60 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border/60 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Guard</div>
          <div className="col-span-4">Checkpoint</div>
          <div className="col-span-3 text-right">Status</div>
        </div>

        {siteLogs.length === 0 && (
          <div className="px-4 py-8 text-sm text-muted-foreground text-center">
            No patrol logs for this location yet.
          </div>
        )}

        {siteLogs.slice(0, 50).map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-12 px-4 py-3 border-b border-border/60 items-center text-sm last:border-0"
          >
            <div className="col-span-2 text-[11px] font-mono text-muted-foreground tabular-nums">
              {format(log.timestamp, "HH:mm")}
            </div>
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
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function ClientLayout() {
  const role   = useAppStore((s) => s.role);
  const logout = useAppStore((s) => s.logout);
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ tab?: string }>("/client/:tab");
  const tab    = (match ? params.tab : "overview") as Tab;
  const client = useActiveClient();
  const site   = getSites().find((s) => s.id === client.siteId);

  useEffect(() => {
    if (role !== "client") setLocation("/client/login");
  }, [role, setLocation]);

  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Top bar */}
      <div className="h-14 px-4 md:px-6 border-b border-border/60 flex items-center gap-3 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="h-7 w-7 rounded-lg bg-secondary border border-border/60 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{site?.name ?? client.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground truncate">{client.name}</div>
        </div>
        <button
          onClick={() => { logout(); setLocation("/"); }}
          className="h-8 w-8 rounded-lg border border-border/60 bg-card/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-border/60 bg-background/80 backdrop-blur">
        {NAV.map((it) => {
          const active = tab === it.key;
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              href={it.href}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors border-b-2",
                active
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && <Overview />}
            {tab === "logs"     && <LogsPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

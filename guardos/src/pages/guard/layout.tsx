import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Home, QrCode, FileWarning, User, WifiOff,
  Siren, ChevronRight, Camera, CheckCircle2, Clock, MapPin,
  ScanLine, LogOut, RefreshCw, CloudOff, Navigation, NavigationOff, Satellite, X,
} from "lucide-react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { useGpsTracking } from "@/hooks/use-gps-tracking";
import { getSites, getCheckpoints, type Guard, type PatrolLog, type Alert } from "@/lib/db";
import { avatarFor } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNowStrict, subDays } from "date-fns";

type Tab = "home" | "patrol" | "incident" | "profile" | "sos";

function useActiveGuard(): Guard | null {
  const userId = useAppStore((s) => s.userId);
  const guards = useAppStore((s) => s.guards);
  return useMemo(() => guards.find((g) => g.id === userId) ?? null, [userId, guards]);
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// ── GPS status pill ───────────────────────────────────────────────────────────
function GpsStatusPill() {
  const isTrackingGps = useAppStore((s) => s.isTrackingGps);
  const userId = useAppStore((s) => s.userId);
  const livePos = useAppStore((s) => (userId ? s.guardPositions[userId] : null));
  if (!isTrackingGps) return null;
  const isReal = livePos?.source === "gps";
  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border",
      isReal ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>
      {isReal ? <Satellite className="h-2.5 w-2.5" /> : <NavigationOff className="h-2.5 w-2.5" />}
      {isReal ? "GPS" : "SIM"}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function GuardHeader({ guard }: { guard: Guard }) {
  const pendingCount = useAppStore((s) => s.pendingCount);
  const clearPending = useAppStore((s) => s.clearPending);
  const site = getSites().find((s) => s.id === guard.siteId);
  return (
    <div className="px-4 pt-3 pb-3 flex items-center justify-between border-b border-border/60">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-none">Assigned Post</div>
          <div className="text-sm font-medium truncate">{site?.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <GpsStatusPill />
        {pendingCount > 0 && (
          <button onClick={clearPending} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] font-mono text-amber-300">
            <WifiOff className="h-2.5 w-2.5" />{pendingCount}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Home tab ──────────────────────────────────────────────────────────────────
function HomeTab({ guard }: { guard: Guard }) {
  const isOnDuty = useAppStore((s) => s.isOnDuty);
  const setOnDuty = useAppStore((s) => s.setOnDuty);
  const livePos = useAppStore((s) => s.guardPositions[guard.id]);
  const gpsPermission = useAppStore((s) => s.gpsPermission);
  const addStoreAlert = useAppStore((s) => s.addAlert);
  const updateGuard = useAppStore((s) => s.updateGuard);
  const { toast } = useToast();
  const site = getSites().find((s) => s.id === guard.siteId);
  const checkpoints = getCheckpoints().filter((c) => c.siteId === guard.siteId);
  const displayLat = livePos?.lat ?? 5.6050;
  const displayLng = livePos?.lng ?? -0.1870;
  const isRealGps = livePos?.source === "gps";

  const handleToggleDuty = (checked: boolean) => {
    setOnDuty(checked);
    updateGuard(guard.id, {
      status: checked ? "on-duty" : "off-duty",
      onDuty: checked,
      shiftStart: checked ? new Date() : null,
      lastActivity: new Date(),
      lastActivityLabel: checked ? "Started shift" : "Ended shift",
    });
    addStoreAlert({
      id: genId(),
      type: checked ? "shift-start" : "shift-end",
      guardId: guard.id, guardDisplayId: guard.guardId, guardName: guard.name,
      siteId: guard.siteId,
      message: `${guard.name} ${checked ? "started" : "ended"} shift at ${site?.name ?? "site"}`,
      timestamp: new Date(), read: false,
    });
    toast({ title: checked ? "Shift started" : "Shift ended", description: checked ? `On duty at ${site?.name}` : "Shift recorded." });
  };

  const recent = [
    { time: "2m ago", text: guard.lastActivityLabel },
    { time: "18m ago", text: "Started shift at " + (site?.name ?? "") },
    { time: "1h ago", text: "Pre-shift equipment check complete" },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      <Card className={cn("p-4 border-border/60 transition-colors", isOnDuty ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card/60")}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Duty Status</div>
            <div className="text-xl font-semibold mt-1">{isOnDuty ? "On Duty" : "Off Duty"}</div>
            {guard.shiftStart && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Shift started {format(guard.shiftStart, "HH:mm")} · {formatDistanceToNowStrict(guard.shiftStart)} ago
              </div>
            )}
          </div>
          <Switch checked={isOnDuty} onCheckedChange={handleToggleDuty} className="data-[state=checked]:bg-emerald-500" />
        </div>
        {isOnDuty && (
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Navigation className="h-3 w-3 text-primary" />
            {gpsPermission === "granted" ? "Real GPS tracking active" : gpsPermission === "denied" ? "GPS denied — simulated position" : "Requesting GPS…"}
          </div>
        )}
      </Card>

      <Card className="p-4 border-border/60 bg-card/60">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Next Checkpoint</div>
          <div className="text-[10px] font-mono text-amber-300">DUE IN 04:12</div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-base font-medium">{checkpoints[0]?.name ?? "All clear"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {site?.address}
            </div>
          </div>
          <Link href="/guard/patrol">
            <Button size="sm" variant="secondary" className="h-8">Open <ChevronRight className="h-3 w-3 ml-1" /></Button>
          </Link>
        </div>
      </Card>

      <Card className="p-0 border-border/60 bg-card/60 overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/60">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Live Position</div>
            <div className="text-xs font-medium">{site?.name}</div>
          </div>
          <div className={cn("text-[10px] font-mono inline-flex items-center gap-1.5", isRealGps ? "text-emerald-300" : "text-amber-300")}>
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isRealGps ? "bg-emerald-400" : "bg-amber-400")} />
            {isRealGps ? "GPS LOCK" : "SIMULATED"}
          </div>
        </div>
        <div className="px-3 py-3 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
          <MapPin className="h-3 w-3 text-primary" />
          {displayLat.toFixed(5)}, {displayLng.toFixed(5)}
          {livePos?.accuracy && <span className="ml-auto text-muted-foreground/60">±{Math.round(livePos.accuracy)}m</span>}
        </div>
      </Card>

      <Card className="p-4 border-border/60 bg-card/60">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Patrol Progress</div>
          <div className="text-xs font-mono text-muted-foreground">0/{checkpoints.length} checkpoints</div>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: "0%" }} />
        </div>
      </Card>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 mb-2">Recent Activity</div>
        <Card className="p-0 border-border/60 bg-card/60 overflow-hidden">
          {recent.map((r, i) => (
            <div key={i} className={cn("px-3 py-2.5 text-sm flex items-start gap-3", i > 0 && "border-t border-border/60")}>
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs">{r.text}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{r.time}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Patrol tab ────────────────────────────────────────────────────────────────
function PatrolTab({ guard }: { guard: Guard }) {
  const { toast } = useToast();
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const checkpoints = getCheckpoints().filter((c) => c.siteId === guard.siteId);
  const addStorePatrolLog = useAppStore((s) => s.addPatrolLog);
  const addStoreAlert = useAppStore((s) => s.addAlert);
  const updateGuard = useAppStore((s) => s.updateGuard);
  const incrementPending = useAppStore((s) => s.incrementPending);

  const completeScan = (id: string, name: string) => {
    setCompletedSet((prev) => new Set(prev).add(id));
    setScanningId(null);
    const log: PatrolLog = {
      id: genId(), guardId: guard.id, guardDisplayId: guard.guardId, guardName: guard.name,
      siteId: guard.siteId, checkpointId: id, checkpointName: name,
      timestamp: new Date(), status: "verified", pendingSync: true,
    };
    addStorePatrolLog(log);
    incrementPending();
    addStoreAlert({ id: genId(), type: "checkpoint", guardId: guard.id, guardDisplayId: guard.guardId, guardName: guard.name, siteId: guard.siteId, message: `${guard.name} checked ${name}`, timestamp: new Date(), read: false });
    updateGuard(guard.id, { lastActivity: new Date(), lastActivityLabel: `Checked ${name}` });
    toast({ title: "Checkpoint verified", description: `${name} logged at ${format(new Date(), "HH:mm:ss")}` });
  };

  if (scanningId) {
    const cp = checkpoints.find((c) => c.id === scanningId)!;
    return (
      <div className="absolute inset-0 bg-background flex flex-col">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
          <div className="text-sm font-medium">Scan Checkpoint QR</div>
          <Button size="sm" variant="ghost" onClick={() => setScanningId(null)}>Cancel</Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Checkpoint</div>
            <div className="text-lg font-semibold">{cp.name}</div>
          </div>
          <div className="relative w-64 h-64 rounded-2xl border border-border/60 bg-black/40 overflow-hidden">
            {["top-2 left-2 border-l-2 border-t-2","top-2 right-2 border-r-2 border-t-2","bottom-2 left-2 border-l-2 border-b-2","bottom-2 right-2 border-r-2 border-b-2"].map((p, i) => (
              <div key={i} className={cn("absolute h-8 w-8 border-primary rounded-md", p)} />
            ))}
            <motion.div className="absolute left-4 right-4 h-0.5 bg-primary shadow-[0_0_12px_2px_hsl(var(--primary))]"
              animate={{ top: ["12%", "85%", "12%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
            <ScanLine className="absolute inset-0 m-auto h-12 w-12 text-primary/20" />
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center">Hold steady · scanning code</div>
          <Button onClick={() => completeScan(cp.id, cp.name)} className="w-full max-w-xs h-11">Confirm Scan</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Tonight's Patrol</div>
        <div className="text-[10px] font-mono text-muted-foreground">{completedSet.size}/{checkpoints.length}</div>
      </div>
      {checkpoints.map((cp, i) => {
        const done = completedSet.has(cp.id);
        const overdue = i === 3 && !done;
        return (
          <Card key={cp.id} className={cn("p-3 border-border/60 bg-card/60 flex items-center justify-between gap-3",
            done && "bg-emerald-500/5 border-emerald-500/30", overdue && "bg-amber-500/5 border-amber-500/40")}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center flex-shrink-0",
                done ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : overdue ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-secondary border-border/60 text-muted-foreground")}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{cp.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">Every {cp.expectedIntervalMins}m · {done ? "verified" : overdue ? "overdue" : "pending"}</div>
              </div>
            </div>
            {!done && <Button size="sm" variant="secondary" onClick={() => setScanningId(cp.id)} className="h-8">Scan</Button>}
          </Card>
        );
      })}
    </div>
  );
}

// ── Camera modal ──────────────────────────────────────────────────────────────

// A small set of demo "captured" scene thumbnails (SVG data URIs — no network)
const DEMO_PHOTOS = [
  // Scene 1 — dark corridor
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='320' height='240' fill='%230d1117'/%3E%3Crect x='120' y='60' width='80' height='120' rx='4' fill='%231e2a3a'/%3E%3Crect x='140' y='80' width='40' height='60' rx='2' fill='%230a0f18'/%3E%3Ccircle cx='160' cy='50' r='8' fill='%23f59e0b' opacity='.6'/%3E%3Ctext x='160' y='210' text-anchor='middle' font-family='monospace' font-size='10' fill='%2364748b'%3ECORRIDOR — EAST WING%3C/text%3E%3C/svg%3E`,
  // Scene 2 — gate / fence
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='320' height='240' fill='%23111827'/%3E%3Crect x='0' y='140' width='320' height='100' fill='%231f2937'/%3E%3Cline x1='40' y1='0' x2='40' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='80' y1='0' x2='80' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='120' y1='0' x2='120' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='160' y1='0' x2='160' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='200' y1='0' x2='200' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='240' y1='0' x2='240' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Cline x1='280' y1='0' x2='280' y2='240' stroke='%23374151' stroke-width='4'/%3E%3Ctext x='160' y='210' text-anchor='middle' font-family='monospace' font-size='10' fill='%2364748b'%3EMAIN GATE — PERIMETER%3C/text%3E%3C/svg%3E`,
  // Scene 3 — parking / open area
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='320' height='240' fill='%230f172a'/%3E%3Crect x='0' y='160' width='320' height='80' fill='%231e293b'/%3E%3Crect x='30' y='100' width='60' height='60' rx='3' fill='%231e3a5f'/%3E%3Crect x='130' y='110' width='60' height='50' rx='3' fill='%231e3a5f'/%3E%3Crect x='230' y='95' width='60' height='65' rx='3' fill='%231e3a5f'/%3E%3Ctext x='160' y='210' text-anchor='middle' font-family='monospace' font-size='10' fill='%2364748b'%3ECAR PARK — ZONE B%3C/text%3E%3C/svg%3E`,
];

type CameraModalProps = {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
};

function CameraModal({ onCapture, onCancel }: CameraModalProps) {
  // 0 = viewfinder  1 = capturing (flash)  2 = preview
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [capturedSrc, setCapturedSrc] = useState("");
  const [scanY, setScanY] = useState(10);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate the scan line in the viewfinder
  useEffect(() => {
    if (phase !== 0) return;
    scanRef.current = setInterval(() => {
      setScanY((y) => (y >= 85 ? 10 : y + 1));
    }, 30);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, [phase]);

  const handleCapture = () => {
    setPhase(1); // flash
    const src = DEMO_PHOTOS[Math.floor(Math.random() * DEMO_PHOTOS.length)];
    setTimeout(() => {
      setCapturedSrc(src);
      setPhase(2);
    }, 350);
  };

  const handleConfirm = () => onCapture(capturedSrc);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="cam-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          key="cam-modal"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="w-full max-w-xs bg-background border border-border/60 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                {phase === 2 ? "Photo captured" : "Camera"}
              </span>
            </div>
            <button onClick={onCancel} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Viewfinder / preview area */}
          <div className="relative bg-black overflow-hidden" style={{ aspectRatio: "4/3" }}>

            {/* ── Phase 0: animated viewfinder ── */}
            {phase === 0 && (
              <>
                {/* Simulated scene — dark gradient with noise */}
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900" />
                {/* Grid overlay */}
                <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
                {/* Corner brackets */}
                {[
                  "top-3 left-3 border-l-2 border-t-2",
                  "top-3 right-3 border-r-2 border-t-2",
                  "bottom-3 left-3 border-l-2 border-b-2",
                  "bottom-3 right-3 border-r-2 border-b-2",
                ].map((cls, i) => (
                  <div key={i} className={`absolute h-6 w-6 border-primary rounded-sm ${cls}`} />
                ))}
                {/* Scan line */}
                <div
                  className="absolute left-4 right-4 h-px bg-primary shadow-[0_0_8px_2px_hsl(var(--primary))] transition-none"
                  style={{ top: `${scanY}%` }}
                />
                {/* Focus dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full border border-primary/60 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                </div>
                {/* HUD labels */}
                <div className="absolute top-2 left-0 right-0 flex justify-center">
                  <span className="text-[9px] font-mono text-primary/70 uppercase tracking-widest">DEMO · LIVE VIEW</span>
                </div>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                    {new Date().toLocaleTimeString("en-GB")}
                  </span>
                </div>
              </>
            )}

            {/* ── Phase 1: capture flash ── */}
            {phase === 1 && (
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ opacity: 1 }} animate={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            )}

            {/* ── Phase 2: captured preview ── */}
            {phase === 2 && capturedSrc && (
              <>
                <img src={capturedSrc} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
                {/* Success overlay */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 20 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30"
                >
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-mono text-emerald-300 font-semibold">Photo captured</span>
                </motion.div>
                {/* Timestamp watermark */}
                <div className="absolute bottom-2 right-3">
                  <span className="text-[9px] font-mono text-white/50">{format(new Date(), "dd/MM/yyyy HH:mm:ss")}</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 flex gap-3">
            {phase === 0 && (
              <>
                <Button variant="secondary" className="flex-1 h-10" onClick={onCancel}>Cancel</Button>
                <Button className="flex-1 h-10 bg-primary" onClick={handleCapture}>
                  <Camera className="h-4 w-4 mr-2" /> Capture
                </Button>
              </>
            )}
            {phase === 1 && (
              <div className="flex-1 h-10 flex items-center justify-center text-xs font-mono text-muted-foreground">
                Capturing…
              </div>
            )}
            {phase === 2 && (
              <>
                <Button variant="secondary" className="flex-1 h-10" onClick={() => { setPhase(0); setCapturedSrc(""); }}>
                  Retake
                </Button>
                <Button className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirm}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Use Photo
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Incident tab ──────────────────────────────────────────────────────────────
type Severity = "info" | "warning" | "critical";

function IncidentTab({ guard }: { guard: Guard }) {
  const { toast } = useToast();
  const addStoreAlert = useAppStore((s) => s.addAlert);
  const incrementPending = useAppStore((s) => s.incrementPending);
  const livePos = useAppStore((s) => s.guardPositions[guard.id]);
  const [severity, setSeverity] = useState<Severity>("warning");
  const [type, setType] = useState("suspicious-person");
  const [description, setDescription] = useState("");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const site = getSites().find((s) => s.id === guard.siteId);
  const geoLat = livePos?.lat ?? 5.6050;
  const geoLng = livePos?.lng ?? -0.1870;
  const isRealGps = livePos?.source === "gps";

  const submit = () => {
    if (!description.trim()) { toast({ title: "Description required" }); return; }
    incrementPending();
    addStoreAlert({ id: genId(), type: "checkpoint", guardId: guard.id, guardDisplayId: guard.guardId, guardName: guard.name, siteId: guard.siteId, message: `${guard.name} filed ${type.replace(/-/g," ")} incident`, timestamp: new Date(), read: false });
    toast({ title: "Incident filed", description: `ID INC-${Math.floor(1000 + Math.random() * 9000)}` });
    setDescription(""); setPhotoAttached(false);
  };

  const TYPES = [
    { v: "suspicious-person", l: "Suspicious person" }, { v: "broken-window", l: "Broken window" },
    { v: "medical", l: "Medical" }, { v: "fire-alarm", l: "Fire alarm" },
    { v: "trespass", l: "Trespass" }, { v: "unattended-package", l: "Unattended package" },
  ];

  return (
    <div className="px-4 py-4 space-y-4 relative">
      {/* Camera modal — rendered inside the scrollable area so it stays within PhoneFrame */}
      {showCamera && (
        <CameraModal
          onCapture={() => { setPhotoAttached(true); setShowCamera(false); toast({ title: "Photo captured", description: "Evidence attached to report." }); }}
          onCancel={() => setShowCamera(false)}
        />
      )}

      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Severity</div>
        <div className="grid grid-cols-3 gap-2">
          {(["info","warning","critical"] as Severity[]).map((s) => (
            <button key={s} onClick={() => setSeverity(s)} className={cn("h-9 rounded-md border text-xs font-mono uppercase tracking-wider transition-colors",
              severity === s ? s === "critical" ? "bg-rose-500/15 border-rose-500/50 text-rose-300" : s === "warning" ? "bg-amber-500/15 border-amber-500/50 text-amber-300" : "bg-sky-500/15 border-sky-500/50 text-sky-300"
              : "border-border/60 bg-card/60 text-muted-foreground")}>{s}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Type</div>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button key={t.v} onClick={() => setType(t.v)} className={cn("h-9 px-2 rounded-md border text-xs text-left transition-colors",
              type === t.v ? "bg-primary/10 border-primary/50 text-primary" : "border-border/60 bg-card/60 text-foreground/80")}>{t.l}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Narrative</div>
        <Textarea rows={4} placeholder="Describe what happened, where, and any actions taken..." value={description} onChange={(e) => setDescription(e.target.value)} className="bg-card/60 border-border/60 resize-none" />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Photo Evidence</div>
        {photoAttached ? (
          /* Attached state — show thumbnail strip with retake option */
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg overflow-hidden border border-emerald-500/30 flex-shrink-0 bg-zinc-900 flex items-center justify-center">
              <Camera className="h-5 w-5 text-emerald-400/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-mono text-emerald-300 font-semibold">Photo attached</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                IMG_{format(new Date(), "yyyyMMdd_HHmmss")}.jpg
              </div>
            </div>
            <button
              onClick={() => setShowCamera(true)}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              Retake
            </button>
          </div>
        ) : (
          /* Empty state — open camera */
          <button
            onClick={() => setShowCamera(true)}
            className="w-full h-24 rounded-lg border border-dashed border-border/60 bg-card/40 text-muted-foreground flex flex-col items-center justify-center gap-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Camera className="h-5 w-5" />
            <span className="text-xs font-mono">Tap to take photo</span>
          </button>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-mono text-muted-foreground truncate">GEOTAG · {geoLat.toFixed(5)}, {geoLng.toFixed(5)} · {site?.name}</span>
        {isRealGps && <span className="ml-auto text-[9px] font-mono text-emerald-400 flex-shrink-0">GPS</span>}
      </div>
      <Button onClick={submit} className="w-full h-11">File Incident Report</Button>
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ guard }: { guard: Guard }) {
  const [, setLocation] = useLocation();
  const logout = useAppStore((s) => s.logout);
  const pendingCount = useAppStore((s) => s.pendingCount);
  const clearPending = useAppStore((s) => s.clearPending);
  const gpsPermission = useAppStore((s) => s.gpsPermission);
  const livePos = useAppStore((s) => s.guardPositions[guard.id]);
  const guardIdx = useAppStore((s) => s.guards).findIndex((g) => g.id === guard.id);
  const avatar = avatarFor(guardIdx);
  const sites = getSites();

  const shifts = Array.from({ length: 7 }).map((_, i) => ({
    date: subDays(new Date(), i),
    hours: 8 + (i % 3),
    site: sites[i % sites.length]?.name ?? "",
  }));

  return (
    <div className="px-4 py-4 space-y-4">
      <Card className="p-4 border-border/60 bg-card/60 flex items-center gap-3">
        <img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover border border-border" />
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{guard.name}</div>
          <div className="text-xs font-mono text-muted-foreground">{guard.guardId}</div>
          <div className="mt-1.5"><StatusBadge status={guard.status} /></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 border-border/60 bg-card/60">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">This Shift</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {guard.shiftStart ? formatDistanceToNowStrict(guard.shiftStart, { unit: "hour" }) : "—"}
          </div>
        </Card>
        <Card className="p-3 border-border/60 bg-card/60">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">This Week</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">42h</div>
        </Card>
      </div>

      <Card className={cn("p-3 border-border/60 flex items-center justify-between", pendingCount > 0 ? "bg-amber-500/5 border-amber-500/40" : "bg-card/60")}>
        <div className="flex items-center gap-2.5">
          {pendingCount > 0 ? <CloudOff className="h-4 w-4 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          <div>
            <div className="text-sm font-medium">{pendingCount > 0 ? "Pending sync" : "All synced"}</div>
            <div className="text-[11px] font-mono text-muted-foreground">{pendingCount > 0 ? `${pendingCount} event${pendingCount === 1 ? "" : "s"} queued` : "Last sync just now"}</div>
          </div>
        </div>
        {pendingCount > 0 && (
          <Button size="sm" variant="secondary" onClick={clearPending} className="h-8">
            <RefreshCw className="h-3 w-3 mr-1" /> Sync
          </Button>
        )}
      </Card>

      <Card className={cn("p-3 border-border/60 flex items-center gap-2.5",
        gpsPermission === "granted" ? "bg-emerald-500/5 border-emerald-500/30" : gpsPermission === "denied" || gpsPermission === "unavailable" ? "bg-amber-500/5 border-amber-500/30" : "bg-card/60")}>
        {gpsPermission === "granted" ? <Satellite className="h-4 w-4 text-emerald-300" /> : <NavigationOff className="h-4 w-4 text-amber-300" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{gpsPermission === "granted" ? "GPS Active" : gpsPermission === "denied" ? "GPS Denied" : gpsPermission === "unavailable" ? "GPS Unavailable" : "GPS Pending"}</div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {livePos ? `${livePos.lat.toFixed(5)}, ${livePos.lng.toFixed(5)} · ±${Math.round(livePos.accuracy)}m · ${livePos.source === "gps" ? "real" : "simulated"}` : "No position yet — go on duty to start tracking"}
          </div>
        </div>
      </Card>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1 mb-2">Shift History</div>
        <Card className="p-0 border-border/60 bg-card/60 overflow-hidden">
          {shifts.map((s, i) => (
            <div key={i} className={cn("px-3 py-2.5 flex items-center justify-between", i > 0 && "border-t border-border/60")}>
              <div>
                <div className="text-xs font-medium">{format(s.date, "EEE, MMM d")}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{s.site}</div>
              </div>
              <div className="text-xs font-mono tabular-nums text-muted-foreground">{s.hours}h</div>
            </div>
          ))}
        </Card>
      </div>

      <Button variant="secondary" className="w-full h-11" onClick={() => { logout(); setLocation("/"); }}>
        <LogOut className="h-4 w-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}

// ── SOS screen ────────────────────────────────────────────────────────────────
function SosScreen({ guard }: { guard: Guard }) {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const holdRef = useRef<number | null>(null);
  const addStoreAlert = useAppStore((s) => s.addAlert);
  const updateGuard = useAppStore((s) => s.updateGuard);

  useEffect(() => {
    if (!confirmed) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [confirmed]);

  const startHold = () => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 3000);
      setProgress(p);
      if (p >= 1) {
        setConfirmed(true);
        holdRef.current = null;
        addStoreAlert({ id: genId(), type: "sos", guardId: guard.id, guardDisplayId: guard.guardId, guardName: guard.name, siteId: guard.siteId, message: `SOS triggered by ${guard.name} (${guard.guardId})`, timestamp: new Date(), read: false });
        updateGuard(guard.id, { status: "alert", lastActivity: new Date(), lastActivityLabel: "SOS triggered" });
        return;
      }
      holdRef.current = requestAnimationFrame(tick);
    };
    holdRef.current = requestAnimationFrame(tick);
  };
  const cancelHold = () => { if (holdRef.current) cancelAnimationFrame(holdRef.current); if (!confirmed) setProgress(0); };
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-rose-950 via-rose-900 to-background flex flex-col">
      <motion.div className="absolute inset-0 bg-rose-500/10 pointer-events-none" animate={{ opacity: [0.15, 0.4, 0.15] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-rose-200">Emergency Protocol</div>
        <Button variant="ghost" size="sm" className="text-rose-100 hover:bg-rose-500/20" onClick={() => setLocation("/guard")}>Close</Button>
      </div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {!confirmed ? (
          <>
            <Siren className="h-10 w-10 text-rose-200 mb-3" />
            <div className="text-2xl font-bold text-rose-50 text-center">Hold to confirm SOS</div>
            <div className="text-sm text-rose-200/80 text-center mt-1 max-w-xs">Dispatch and supervisor will be alerted with your live location.</div>
            <div className="relative mt-10 mb-6">
              <svg width={220} height={220} className="-rotate-90">
                <circle cx={110} cy={110} r={96} className="stroke-rose-500/30 fill-none" strokeWidth={8} />
                <circle cx={110} cy={110} r={96} className="stroke-rose-300 fill-none transition-[stroke-dashoffset]" strokeWidth={8} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 96} strokeDashoffset={2 * Math.PI * 96 * (1 - progress)} />
              </svg>
              <button onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold} onTouchStart={startHold} onTouchEnd={cancelHold}
                className="absolute inset-0 m-auto h-44 w-44 rounded-full bg-rose-500 text-white text-lg font-bold tracking-wider shadow-[0_0_60px_-5px_rgba(244,63,94,0.7)] active:scale-95 transition-transform select-none">
                HOLD
              </button>
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-rose-200/70">Hold 3 seconds to dispatch</div>
          </>
        ) : (
          <>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-20 w-20 rounded-full bg-rose-500/30 border border-rose-300 flex items-center justify-center mb-4">
              <Siren className="h-10 w-10 text-rose-100" />
            </motion.div>
            <div className="text-2xl font-bold text-rose-50 text-center">Dispatch notified</div>
            <div className="text-sm text-rose-200 mt-1 text-center max-w-xs">Backup en route. Stay where you are if safe to do so.</div>
            <div className="font-mono text-5xl tabular-nums text-rose-50 mt-8">{mm}:{ss}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-rose-200/70 mt-1">Elapsed</div>
            <Button variant="secondary" className="mt-10 h-11 px-8 bg-rose-50 text-rose-900 hover:bg-white" onClick={() => setLocation("/guard")}>Cancel SOS</Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Bottom nav ────────────────────────────────────────────────────────────────
function BottomNav({ tab }: { tab: Tab }) {
  const items: { key: Tab; href: string; label: string; icon: typeof Home }[] = [
    { key: "home", href: "/guard", label: "Home", icon: Home },
    { key: "patrol", href: "/guard/patrol", label: "Patrol", icon: QrCode },
    { key: "incident", href: "/guard/incident", label: "Report", icon: FileWarning },
    { key: "profile", href: "/guard/profile", label: "Profile", icon: User },
  ];
  return (
    <div className="border-t border-border/60 bg-background/95 backdrop-blur-md">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = tab === it.key;
          const Icon = it.icon;
          return (
            <Link key={it.key} href={it.href} className={cn("flex flex-col items-center gap-0.5 py-2.5 transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-mono uppercase tracking-wider">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Floating SOS ──────────────────────────────────────────────────────────────
function FloatingSos() {
  return (
    <Link href="/guard/sos">
      <button className="absolute right-4 bottom-20 h-14 w-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-[0_0_30px_-5px_rgba(244,63,94,0.7)] active:scale-95 transition-transform z-30" aria-label="Emergency SOS">
        <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-40" />
        <Siren className="h-6 w-6 relative" />
      </button>
    </Link>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function GuardLayout() {
  const guard = useActiveGuard();
  const [match, params] = useRoute<{ tab?: string }>("/guard/:tab");
  const [, setLocation] = useLocation();
  const role = useAppStore((s) => s.role);
  const userId = useAppStore((s) => s.userId);

  useGpsTracking(userId);

  useEffect(() => {
    if (role !== "guard") setLocation("/guard/login");
  }, [role, setLocation]);

  if (!guard) return null;

  const tab = (match ? params.tab : "home") as Tab;

  if (tab === "sos") {
    return (
      <PhoneFrame>
        <div className="relative h-full bg-background">
          <SosScreen guard={guard} />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="flex flex-col h-full bg-background relative">
        <GuardHeader guard={guard} />
        <div className="flex-1 overflow-y-auto pb-24">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {tab === "home" && <HomeTab guard={guard} />}
              {tab === "patrol" && <PatrolTab guard={guard} />}
              {tab === "incident" && <IncidentTab guard={guard} />}
              {tab === "profile" && <ProfileTab guard={guard} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20">
          <BottomNav tab={tab} />
        </div>
        <FloatingSos />
      </div>
    </PhoneFrame>
  );
}

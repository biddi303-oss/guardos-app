import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { getSites, getGuards, type Guard, type Site } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const SITE_POSITIONS: Record<string, { x: number; y: number }> = {
  s1: { x: 180, y: 160 },
  s2: { x: 460, y: 130 },
  s3: { x: 620, y: 320 },
  s4: { x: 280, y: 380 },
};

// Convert configured meters → svg pixels (~0.3 px/m for our viewBox).
function metersToSvg(m: number): number {
  return Math.max(28, Math.min(140, m * 0.3));
}

function projectGuardToSite(guard: Guard, radiusPx: number) {
  const sitePos = SITE_POSITIONS[guard.siteId] ?? { x: 400, y: 250 };
  // Use a deterministic offset based on guard id since we no longer have lastLocation
  const seed = guard.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const ox = ((seed * 17 % 100) - 50) * (radiusPx / 60);
  const oy = ((seed * 31 % 100) - 50) * (radiusPx / 60);
  const breachPush = guard.status === "alert" ? 1.25 : 0.7;
  return { x: sitePos.x + ox * breachPush, y: sitePos.y + oy * breachPush };
}

function GuardPin({ guard, drift, radiusPx }: { guard: Guard; drift: number; radiusPx: number }) {
  const base = projectGuardToSite(guard, radiusPx);
  const sitePos = SITE_POSITIONS[guard.siteId];
  const color =
    guard.status === "alert"
      ? "fill-rose-500 stroke-rose-300"
      : guard.status === "off-duty"
      ? "fill-zinc-600 stroke-zinc-400"
      : "fill-emerald-400 stroke-emerald-200";
  return (
    <motion.g
      animate={{ x: [0, Math.sin(drift) * 6, 0], y: [0, Math.cos(drift * 1.3) * 6, 0] }}
      transition={{ duration: 4 + (guard.id.length % 3), repeat: Infinity, ease: "easeInOut" }}
    >
      {guard.status === "alert" && sitePos && (
        <line
          x1={sitePos.x}
          y1={sitePos.y}
          x2={base.x}
          y2={base.y}
          className="stroke-rose-400/70"
          strokeWidth={1.2}
          strokeDasharray="2 3"
        />
      )}
      {guard.status === "alert" && (
        <circle cx={base.x} cy={base.y} r={14} className="fill-rose-500/30">
          <animate attributeName="r" values="6;18;6" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={base.x} cy={base.y} r={4.5} className={cn(color, "stroke-2")} />
    </motion.g>
  );
}

function GeofenceZone({ site, radiusPx, breached, showLabel }: { site: Site; radiusPx: number; breached: boolean; showLabel: boolean }) {
  const pos = SITE_POSITIONS[site.id];
  if (!pos) return null;
  return (
    <g>
      <circle
        cx={pos.x}
        cy={pos.y}
        r={radiusPx}
        className={cn(
          "fill-primary/[0.04] transition-colors",
          breached ? "stroke-rose-400/80" : "stroke-primary/30",
        )}
        strokeDasharray="3 4"
        strokeWidth={1}
      />
      {/* inner solid hint of the actual building */}
      <circle cx={pos.x} cy={pos.y} r={Math.max(10, radiusPx * 0.18)} className="fill-primary/15 stroke-primary/40" strokeWidth={1} />
      {showLabel && (
        <text x={pos.x} y={pos.y - radiusPx - 8} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono uppercase tracking-widest">
          {site.name}
        </text>
      )}
    </g>
  );
}

interface MockMapProps {
  className?: string;
  highlightGuardId?: string;
  /** Show the site name labels above each geofence ring (default true). */
  showLabels?: boolean;
  /** Override geofence radii from the store (e.g. preview slider value). */
  radiiOverride?: Record<string, number>;
  /** Only render this site (used in detail panes). */
  onlySiteId?: string;
}

export function MockMap({ className, highlightGuardId, showLabels = true, radiiOverride, onlySiteId }: MockMapProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(i);
  }, []);
  const alerts = useAppStore((s) => s.alerts);
  const radii = useAppStore((s) => s.geofenceRadii);

  const radiusFor = (siteId: string) => {
    const meters = (radiiOverride ?? radii)[siteId] ?? 200;
    return metersToSvg(meters);
  };
  const breachedSites = useMemo(
    () => new Set(alerts.filter((a) => !a.read && a.type === "sos").map((a) => a.siteId)),
    [alerts],
  );
  const visibleSites = useMemo(
    () => {
      const allSites = getSites();
      return onlySiteId ? allSites.filter((s) => s.id === onlySiteId) : allSites;
    },
    [onlySiteId],
  );
  const visibleGuards = useMemo(
    () => {
      const allGuards = getGuards();
      return onlySiteId ? allGuards.filter((g) => g.siteId === onlySiteId) : allGuards;
    },
    [onlySiteId],
  );

  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg border border-border/60 bg-[hsl(222,47%,5%)]", className)}>
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />

      <svg viewBox="0 0 800 480" className="relative w-full h-full">
        <g className="stroke-border/70" strokeWidth={1} fill="none">
          <path d="M0 100 Q200 80 400 110 T800 90" />
          <path d="M0 240 Q300 220 500 260 T800 230" />
          <path d="M0 380 Q200 360 450 400 T800 380" />
          <path d="M150 0 Q170 200 130 480" />
          <path d="M380 0 Q400 240 360 480" />
          <path d="M600 0 Q620 240 580 480" />
        </g>

        {visibleSites.map((s) => (
          <GeofenceZone
            key={s.id}
            site={s}
            radiusPx={radiusFor(s.id)}
            breached={breachedSites.has(s.id)}
            showLabel={showLabels}
          />
        ))}

        {visibleGuards.map((g, i) => (
          <GuardPin key={g.id} guard={g} drift={tick + i} radiusPx={radiusFor(g.siteId)} />
        ))}

        {visibleSites
          .filter((s) => breachedSites.has(s.id))
          .map((s) => {
            const pos = SITE_POSITIONS[s.id];
            const r = radiusFor(s.id);
            return (
              <circle
                key={`ring-${s.id}`}
                cx={pos.x}
                cy={pos.y}
                r={r + 8}
                className="fill-none stroke-rose-500/70"
                strokeWidth={1.2}
              >
                <animate attributeName="r" values={`${r + 4};${r + 22};${r + 4}`} dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
              </circle>
            );
          })}

        {highlightGuardId &&
          (() => {
            const g = getGuards().find((x) => x.id === highlightGuardId);
            if (!g) return null;
            const pos = projectGuardToSite(g, radiusFor(g.siteId));
            return <circle cx={pos.x} cy={pos.y} r={10} className="fill-none stroke-primary" strokeWidth={1.5} />;
          })()}
      </svg>

      <div className="absolute bottom-2 right-3 font-mono text-[10px] text-muted-foreground/80 flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ACTIVE
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> OFFLINE
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> BREACH
        </span>
      </div>
      <div className="absolute top-2 left-3 font-mono text-[10px] text-muted-foreground/80">
        {onlySiteId ? "GEOFENCE PREVIEW" : `LIVE GRID · ${visibleGuards.length} UNITS`}
      </div>
    </div>
  );
}

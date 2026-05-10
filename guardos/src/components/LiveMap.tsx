import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Layers, Plus, Minus, Locate, Maximize2 } from "lucide-react";
import { getSites, getGuards, type Guard } from "@/lib/db";
import { useAppStore } from "@/lib/store";
import {
  MAP_BOUNDS,
  MAP_VIEW,
  boundaryRadiusPx,
  boundaryToSvg,
  defaultBoundaryFor,
  guardLivePosition,
  metersToPx,
  patrolRoute,
  polygonToPath,
  project,
  routeToPath,
  siteFootprint,
  unproject,
  type LatLng,
} from "@/lib/geo";
import { cn } from "@/lib/utils";

// ---------- Map decorations: roads, water, parks ----------

// Pre-computed in svg space (1000x600). Hand-drawn to mimic an urban street grid.
const ROAD_HIGHWAYS = [
  // Sweeping freeway across the upper portion
  "M 0 130 C 200 90 380 200 580 160 S 880 110 1000 170",
  // Curving expressway along the lower portion
  "M 0 480 C 220 520 420 430 620 470 S 880 540 1000 500",
];

const ROAD_MAJORS = [
  // Vertical avenues
  "M 140 0 L 160 600",
  "M 360 0 L 380 600",
  "M 600 0 L 620 600",
  "M 820 0 L 800 600",
  // Horizontal boulevards
  "M 0 250 L 1000 240",
  "M 0 360 L 1000 380",
];

// Generate a denser minor street grid programmatically.
function buildMinorRoads(): string[] {
  const out: string[] = [];
  for (let x = 60; x < 1000; x += 80) {
    if ([140, 360, 600, 820].some((m) => Math.abs(m - x) < 25)) continue;
    out.push(`M ${x} 0 L ${x + 8} 600`);
  }
  for (let y = 50; y < 600; y += 70) {
    if ([250, 360].some((m) => Math.abs(m - y) < 25)) continue;
    out.push(`M 0 ${y} L 1000 ${y + 6}`);
  }
  return out;
}
const ROAD_MINORS = buildMinorRoads();

const WATER_SHAPES = [
  // Bay along the right edge (Pier 19 sits near it)
  "M 880 0 L 1000 0 L 1000 600 L 920 600 C 870 480 940 360 900 240 C 870 160 920 80 880 0 Z",
];

const PARKS = [
  // Park near the embassy quarter
  "M 60 380 C 120 360 200 400 220 460 C 200 510 120 520 80 480 Z",
  // Park near downtown
  "M 540 80 C 600 60 660 90 670 140 C 640 180 560 180 540 130 Z",
];

// Random building footprints scattered along streets (for the dense city look).
function buildCityBlocks(): { x: number; y: number; w: number; h: number; r: number }[] {
  const rng = (() => {
    let s = 0xc0ffee;
    return () => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 4294967296;
    };
  })();
  const blocks: { x: number; y: number; w: number; h: number; r: number }[] = [];
  for (let i = 0; i < 110; i++) {
    const x = 30 + rng() * 940;
    const y = 30 + rng() * 540;
    // Skip if inside water region (roughly right edge)
    if (x > 870) continue;
    const w = 14 + rng() * 30;
    const h = 12 + rng() * 22;
    blocks.push({ x, y, w, h, r: (rng() - 0.5) * 14 });
  }
  return blocks;
}
const CITY_BLOCKS = buildCityBlocks();

const STREET_LABELS: { x: number; y: number; text: string; rotate?: number }[] = [
  { x: 200, y: 124, text: "I-280 EXPRESSWAY", rotate: -6 },
  { x: 720, y: 152, text: "MARKET ST", rotate: -4 },
  { x: 200, y: 510, text: "EMBARCADERO", rotate: 2 },
  { x: 380, y: 244, text: "MISSION ST", rotate: -1 },
  { x: 600, y: 376, text: "HOWARD ST", rotate: 1 },
  { x: 162, y: 380, text: "VAN NESS AVE", rotate: -90 },
  { x: 622, y: 320, text: "MONTGOMERY ST", rotate: -90 },
  { x: 940, y: 320, text: "SAN FRANCISCO BAY" },
  { x: 130, y: 460, text: "CIVIC PARK" },
];

// ---------- Component ----------

interface LiveMapProps {
  className?: string;
  /** Restrict rendering to a single site (used in detail panes / client portal). */
  onlySiteId?: string;
  /** Override geofence radii (preview slider). */
  radiiOverride?: Record<string, number>;
  /** Override boundaries (used by the live editor in the Geofences page). */
  boundariesOverride?: Record<string, LatLng[]>;
  /** Hide the map controls overlay (useful for tiny embedded maps). */
  hideControls?: boolean;
  /** Enable click-to-select guards (admin). */
  selectable?: boolean;
  /** Show a "© GuardOS Maps" attribution. Default true. */
  attribution?: boolean;
  /** Render a smaller / minimal layout (no labels / no controls). */
  minimal?: boolean;
  /** Mark a single guard as the focus (mobile guard view). */
  focusGuardId?: string;
  /** Optional click handler for the entire map background. */
  onBackgroundClick?: () => void;
  /** When set, the boundary for this site can be edited in-map. Requires onlySiteId. */
  editableSiteId?: string;
  /** Drag/insert/delete callback for the boundary editor. */
  onBoundaryChange?: (boundary: LatLng[]) => void;
}

export function LiveMap({
  className,
  onlySiteId,
  radiiOverride,
  boundariesOverride,
  hideControls,
  selectable,
  attribution = true,
  minimal,
  focusGuardId,
  onBackgroundClick,
  editableSiteId,
  onBoundaryChange,
}: LiveMapProps) {
  const alerts = useAppStore((s) => s.alerts);
  const radii = useAppStore((s) => s.geofenceRadii);
  const storedBoundaries = useAppStore((s) => s.siteBoundaries);
  const selectedGuardId = useAppStore((s) => s.selectedGuardId);
  const setSelectedGuardId = useAppStore((s) => s.setSelectedGuardId);
  const layers = useAppStore((s) => s.mapLayers);
  const toggleLayer = useAppStore((s) => s.toggleMapLayer);
  /** Real GPS positions keyed by guardId — may be empty for guards not on duty. */
  const guardPositions = useAppStore((s) => s.guardPositions);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [layersOpen, setLayersOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [hoverGuardId, setHoverGuardId] = useState<string | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /** Resolve the boundary used to render and (optionally) edit a site. */
  const boundaryFor = (siteId: string): LatLng[] => {
    const site = getSites().find((s) => s.id === siteId);
    return (
      boundariesOverride?.[siteId] ??
      storedBoundaries[siteId] ??
      (site ? defaultBoundaryFor(site, radii[siteId] ?? 220) : [])
    );
  };

  /** Convert a browser-space pointer event into the map's SVG coordinate space. */
  const clientToSvg = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const mapped = pt.matrixTransform(ctm.inverse());
    return { x: mapped.x, y: mapped.y };
  };

  // Vertex drag handling for boundary editor
  useEffect(() => {
    if (draggingVertex === null || !editableSiteId) return;
    const onMove = (e: MouseEvent) => {
      const svgPt = clientToSvg(e.clientX, e.clientY);
      if (!svgPt) return;
      const ll = unproject(svgPt.x, svgPt.y);
      const current = boundaryFor(editableSiteId);
      const next = current.map((v, i) => (i === draggingVertex ? ll : v));
      onBoundaryChange?.(next);
    };
    const onUp = () => setDraggingVertex(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingVertex, editableSiteId]);

  const insertVertexAfter = (index: number) => {
    if (!editableSiteId) return;
    const current = boundaryFor(editableSiteId);
    const a = current[index];
    const b = current[(index + 1) % current.length];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const next = [...current.slice(0, index + 1), mid, ...current.slice(index + 1)];
    onBoundaryChange?.(next);
  };

  const deleteVertex = (index: number) => {
    if (!editableSiteId) return;
    const current = boundaryFor(editableSiteId);
    if (current.length <= 3) return;
    onBoundaryChange?.(current.filter((_, i) => i !== index));
  };

  // Re-render every 4s so guard pins/route tails wobble subtly.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(i);
  }, []);

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

  const breachedSites = useMemo(
    () =>
      new Set(
        alerts
          .filter((a) => !a.read && a.type === "sos")
          .map((a) => a.siteId),
      ),
    [alerts],
  );

  const radiusFor = (siteId: string) => {
    // Prefer the polygon's effective radius (so patrol routes match the boundary)
    const boundary = boundaryFor(siteId);
    if (boundary.length >= 3) return boundaryRadiusPx(boundary);
    return metersToPx((radiiOverride ?? radii)[siteId] ?? 220);
  };

  // Compute viewBox based on zoom + pan, optionally framing onlySiteId.
  const viewBox = useMemo(() => {
    if (onlySiteId) {
      const site = visibleSites[0];
      if (site) {
        const c = project(site.zone.lat, site.zone.lng);
        const r = radiusFor(site.id) * 2.4;
        return `${c.x - r} ${c.y - r * 0.6} ${r * 2} ${r * 1.2}`;
      }
    }
    const w = MAP_VIEW.width / zoom;
    const h = MAP_VIEW.height / zoom;
    const x = (MAP_VIEW.width - w) / 2 + pan.x;
    const y = (MAP_VIEW.height - h) / 2 + pan.y;
    return `${x} ${y} ${w} ${h}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pan, onlySiteId, visibleSites, storedBoundaries, boundariesOverride]);

  const handleSelect = (g: Guard) => {
    if (!selectable) return;
    setSelectedGuardId(selectedGuardId === g.id ? null : g.id);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden rounded-lg border border-border/60",
        className,
      )}
      style={{ background: "#0e1726" }}
    >
      {/* Subtle vignette / atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        onClick={() => {
          if (onBackgroundClick) onBackgroundClick();
          if (selectable) setSelectedGuardId(null);
        }}
      >
        <defs>
          <pattern id="map-grain" patternUnits="userSpaceOnUse" width="6" height="6">
            <rect width="6" height="6" fill="transparent" />
            <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.018)" />
          </pattern>
          <radialGradient id="alert-pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(244,63,94,0.55)" />
            <stop offset="100%" stopColor="rgba(244,63,94,0)" />
          </radialGradient>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
          </linearGradient>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Map base */}
        <rect x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} fill="#0e1726" />
        <rect x="0" y="0" width={MAP_VIEW.width} height={MAP_VIEW.height} fill="url(#map-grain)" />

        {/* Water */}
        {WATER_SHAPES.map((d, i) => (
          <path key={i} d={d} fill="#15324d" stroke="#1c4267" strokeWidth={0.5} />
        ))}

        {/* Parks */}
        {PARKS.map((d, i) => (
          <path key={i} d={d} fill="#1d3a2c" stroke="#244a39" strokeWidth={0.5} />
        ))}

        {/* City blocks */}
        {layers.buildings &&
          CITY_BLOCKS.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              transform={`rotate(${b.r} ${b.x + b.w / 2} ${b.y + b.h / 2})`}
              fill="#1a2638"
              stroke="#243349"
              strokeWidth={0.4}
              rx={1.5}
            />
          ))}

        {/* Minor roads */}
        <g stroke="#243345" strokeWidth={2.4} fill="none" strokeLinecap="round">
          {ROAD_MINORS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Road casing for major roads */}
        <g stroke="#3a4d63" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.95}>
          {ROAD_MAJORS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Major roads inner */}
        <g stroke="#2d3e52" strokeWidth={6} fill="none" strokeLinecap="round">
          {ROAD_MAJORS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Highway casing */}
        <g stroke="#5d7da1" strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.85}>
          {ROAD_HIGHWAYS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Highway inner */}
        <g stroke="#3d5a7e" strokeWidth={8} fill="none" strokeLinecap="round">
          {ROAD_HIGHWAYS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* Highway centerline (dashed) */}
        <g stroke="#a8c4e6" strokeWidth={0.6} fill="none" strokeLinecap="round" strokeDasharray="6 6" opacity={0.5}>
          {ROAD_HIGHWAYS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* Street labels */}
        {layers.labels &&
          !minimal &&
          STREET_LABELS.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined}
              textAnchor="middle"
              className="fill-[#5c7393] font-sans"
              style={{ fontSize: 9, letterSpacing: 1, fontWeight: 500 }}
            >
              {l.text}
            </text>
          ))}

        {/* Geofence patrol zones (custom polygon boundary per site) */}
        {layers.geofences &&
          visibleSites.map((site) => {
            const boundary = boundaryFor(site.id);
            if (boundary.length < 3) return null;
            const poly = boundaryToSvg(boundary);
            const breached = breachedSites.has(site.id);
            const isEditing = editableSiteId === site.id;
            return (
              <g key={`geo-${site.id}`}>
                <path
                  d={polygonToPath(poly)}
                  fill={breached ? "rgba(244,63,94,0.10)" : "rgba(244,63,94,0.05)"}
                  stroke={breached ? "rgba(244,63,94,0.95)" : "rgba(244,63,94,0.7)"}
                  strokeWidth={breached ? 2 : 1.4}
                  strokeDasharray={breached || isEditing ? "0" : "5 4"}
                />
                {breached && (
                  <path
                    d={polygonToPath(poly)}
                    fill="none"
                    stroke="rgba(244,63,94,0.55)"
                    strokeWidth={3}
                  >
                    <animate attributeName="stroke-width" values="2;7;2" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
                  </path>
                )}
              </g>
            );
          })}

        {/* Boundary editor overlay (handles, midpoints) */}
        {editableSiteId && onlySiteId === editableSiteId && (() => {
          const boundary = boundaryFor(editableSiteId);
          if (boundary.length < 2) return null;
          const poly = boundaryToSvg(boundary);
          return (
            <g key="boundary-editor">
              {/* Edge midpoint "+" handles to insert vertices */}
              {poly.map((p, i) => {
                const next = poly[(i + 1) % poly.length];
                const mx = (p.x + next.x) / 2;
                const my = (p.y + next.y) / 2;
                return (
                  <g
                    key={`mid-${i}`}
                    transform={`translate(${mx}, ${my})`}
                    style={{ cursor: "copy" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      insertVertexAfter(i);
                    }}
                  >
                    <circle r={4} fill="rgba(20,30,45,0.95)" stroke="hsl(var(--primary))" strokeWidth={1} />
                    <line x1={-2} y1={0} x2={2} y2={0} stroke="hsl(var(--primary))" strokeWidth={1} />
                    <line x1={0} y1={-2} x2={0} y2={2} stroke="hsl(var(--primary))" strokeWidth={1} />
                  </g>
                );
              })}
              {/* Vertex handles (drag to move, shift-click to delete) */}
              {poly.map((p, i) => (
                <g
                  key={`vx-${i}`}
                  transform={`translate(${p.x}, ${p.y})`}
                  style={{ cursor: draggingVertex === i ? "grabbing" : "grab" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey || e.altKey) {
                      deleteVertex(i);
                    } else {
                      setDraggingVertex(i);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteVertex(i);
                  }}
                >
                  <circle r={6} fill="rgba(20,30,45,0.96)" stroke="hsl(var(--primary))" strokeWidth={1.5} />
                  <circle r={2.4} fill="hsl(var(--primary))" />
                </g>
              ))}
            </g>
          );
        })()}

        {/* Site footprints (the actual building) */}
        {visibleSites.map((s) => {
          const fp = siteFootprint(s);
          return (
            <g key={`fp-${s.id}`}>
              <rect
                x={fp.x}
                y={fp.y}
                width={fp.w}
                height={fp.h}
                rx={3}
                transform={`rotate(${fp.rotate} ${fp.x + fp.w / 2} ${fp.y + fp.h / 2})`}
                fill="#2a3d56"
                stroke="hsl(var(--primary) / 0.6)"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Patrol route traces (live paths) */}
        {layers.routes &&
          visibleGuards.map((g) => {
            const r = radiusFor(g.siteId);
            const route = patrolRoute(g, r);
            const live = guardLivePosition(g, r);
            const isFocus = focusGuardId === g.id;
            const isSelected = selectedGuardId === g.id;
            const color =
              g.status === "alert"
                ? "rgba(244,63,94,0.85)"
                : g.status === "off-duty"
                ? "rgba(120,130,150,0.55)"
                : "hsl(var(--primary))";
            const opacity = isFocus || isSelected ? 1 : 0.55;
            return (
              <g key={`route-${g.id}`} opacity={opacity}>
                {/* glow */}
                <path
                  d={routeToPath(route)}
                  stroke={color}
                  strokeWidth={isFocus || isSelected ? 6 : 4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.18}
                />
                {/* main */}
                <path
                  d={routeToPath(route)}
                  stroke={color}
                  strokeWidth={isFocus || isSelected ? 2.2 : 1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* movement direction dashes flowing forward */}
                <path
                  d={routeToPath(route)}
                  stroke={color}
                  strokeWidth={1.2}
                  fill="none"
                  strokeDasharray="2 6"
                  opacity={0.85}
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="3s" repeatCount="indefinite" />
                </path>
                {/* sparse waypoint dots */}
                {route.filter((_, idx) => idx % 6 === 0).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={1.1} fill={color} opacity={0.7} />
                ))}
                {/* current breach dashed lead-out */}
                {g.status === "alert" && (
                  <line
                    x1={route[route.length - 1].x}
                    y1={route[route.length - 1].y}
                    x2={live.x}
                    y2={live.y}
                    stroke="rgba(244,63,94,0.9)"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            );
          })}

        {/* Site labels */}
        {layers.labels &&
          !minimal &&
          visibleSites.map((s) => {
            const c = project(s.zone.lat, s.zone.lng);
            const r = radiusFor(s.id);
            return (
              <g key={`lab-${s.id}`}>
                <rect
                  x={c.x - 60}
                  y={c.y + r * 0.85 + 4}
                  width={120}
                  height={16}
                  rx={3}
                  fill="rgba(20,30,45,0.92)"
                  stroke="hsl(var(--primary) / 0.45)"
                  strokeWidth={0.6}
                />
                <text
                  x={c.x}
                  y={c.y + r * 0.85 + 15}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: 9, letterSpacing: 0.6, fontWeight: 600 }}
                >
                  {s.name.toUpperCase()}
                </text>
              </g>
            );
          })}

        {/* Guard pins */}
        {visibleGuards.map((g, i) => {
          const r = radiusFor(g.siteId);
          // Prefer real GPS position from store; fall back to simulated patrol route tail.
          const realPos = guardPositions[g.id];
          const pos = realPos
            ? project(realPos.lat, realPos.lng)
            : guardLivePosition(g, r);
          const isRealGps = !!realPos && realPos.source === "gps";
          const isSelected = selectedGuardId === g.id;
          const isFocus = focusGuardId === g.id;
          const isHovered = hoverGuardId === g.id;
          const isAlert = g.status === "alert";
          const isOffline = g.status === "off-duty";
          const fill = isAlert
            ? "#f43f5e"
            : isOffline
            ? "#6b7689"
            : "hsl(var(--primary))";
          const wobblePhase = (tick * 0.4 + i) % (Math.PI * 2);
          // Only wobble simulated positions; real GPS positions are stable
          const dx = realPos ? 0 : Math.sin(wobblePhase) * 1.5;
          const dy = realPos ? 0 : Math.cos(wobblePhase * 1.3) * 1.5;
          return (
            <g
              key={g.id}
              transform={`translate(${pos.x + dx}, ${pos.y + dy})`}
              style={{ cursor: selectable ? "pointer" : "default" }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(g);
              }}
              onMouseEnter={() => setHoverGuardId(g.id)}
              onMouseLeave={() => setHoverGuardId(null)}
            >
              {/* alert pulse */}
              {isAlert && (
                <circle r={20} fill="url(#alert-pulse)">
                  <animate attributeName="r" values="14;28;14" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {/* GPS accuracy ring (only for real GPS positions) */}
              {isRealGps && realPos.accuracy && (
                <circle
                  r={Math.min(metersToPx(realPos.accuracy), 40)}
                  fill="hsl(var(--primary) / 0.06)"
                  stroke="hsl(var(--primary) / 0.3)"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />
              )}
              {/* selection ring */}
              {(isSelected || isFocus) && (
                <circle r={14} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.7}>
                  <animate attributeName="r" values="11;16;11" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* pin shadow */}
              <ellipse cx={0} cy={6} rx={5} ry={2} fill="rgba(0,0,0,0.45)" filter="url(#pin-shadow)" />
              {/* pin teardrop */}
              <path
                d="M 0 -10 C 5 -10 7 -6 7 -2 C 7 3 0 8 0 8 C 0 8 -7 3 -7 -2 C -7 -6 -5 -10 0 -10 Z"
                fill={fill}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={0.6}
              />
              {/* badge initial */}
              <circle cx={0} cy={-3} r={3.4} fill="rgba(255,255,255,0.95)" />
              <text
                x={0}
                y={-1.4}
                textAnchor="middle"
                fontSize="4.4"
                fontWeight={700}
                fill="#0a1422"
              >
                {g.name.charAt(0)}
              </text>
              {/* GPS indicator dot (top-right of pin) */}
              {isRealGps && (
                <circle cx={5} cy={-9} r={2} fill="#34d399" stroke="#0a1422" strokeWidth={0.5}>
                  <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Hover tooltip */}
              {(isHovered || isSelected) && !minimal && (
                <g transform="translate(10, -22)">
                  <rect
                    x={0}
                    y={0}
                    width={160}
                    height={isRealGps ? 46 : 36}
                    rx={4}
                    fill="rgba(15,22,38,0.96)"
                    stroke={fill}
                    strokeWidth={1}
                  />
                  <text x={8} y={14} fill="white" fontSize={8} fontWeight={600}>
                    {g.name}
                  </text>
                  <text x={8} y={26} fill="rgba(255,255,255,0.6)" fontSize={7}>
                    {g.guardId} · {g.status.toUpperCase()}
                  </text>
                  {isRealGps && realPos && (
                    <text x={8} y={38} fill="#34d399" fontSize={6.5}>
                      GPS {realPos.lat.toFixed(4)}, {realPos.lng.toFixed(4)} ±{Math.round(realPos.accuracy)}m
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Map controls overlay */}
      {!hideControls && !minimal && (
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
          <div className="bg-[#1a2638]/95 backdrop-blur border border-white/10 rounded-md shadow-lg overflow-hidden">
            <button
              className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/10 border-b border-white/10"
              onClick={() => setZoom((z) => Math.min(3, z + 0.3))}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/10"
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.3))}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <button
            className="w-9 h-9 bg-[#1a2638]/95 backdrop-blur border border-white/10 rounded-md shadow-lg flex items-center justify-center text-white/80 hover:bg-white/10"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Recenter"
            title="Recenter"
          >
            <Locate className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              className={cn(
                "w-9 h-9 bg-[#1a2638]/95 backdrop-blur border border-white/10 rounded-md shadow-lg flex items-center justify-center text-white/80 hover:bg-white/10",
                layersOpen && "ring-2 ring-primary/50",
              )}
              onClick={() => setLayersOpen((v) => !v)}
              aria-label="Layers"
            >
              <Layers className="h-4 w-4" />
            </button>
            {layersOpen && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute right-11 top-0 w-44 bg-[#1a2638]/98 backdrop-blur border border-white/10 rounded-md shadow-2xl p-2 z-30"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/50 px-1 pb-1.5">
                  Map Layers
                </div>
                {(["routes", "geofences", "labels", "buildings"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => toggleLayer(k)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 text-xs text-white/80"
                  >
                    <span className="capitalize">{k}</span>
                    <span
                      className={cn(
                        "h-3 w-6 rounded-full transition-colors flex items-center px-0.5",
                        layers[k] ? "bg-primary justify-end" : "bg-white/15 justify-start",
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Compass + scale bar */}
      {!hideControls && !minimal && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#1a2638]/95 backdrop-blur border border-white/10 flex items-center justify-center text-white/80 shadow-lg">
            <Compass className="h-4 w-4" />
          </div>
          <div className="px-2 py-1 rounded bg-[#1a2638]/95 backdrop-blur border border-white/10 text-[10px] font-mono text-white/70 shadow-lg flex items-center gap-2">
            <Maximize2 className="h-3 w-3" />
            LIVE · {visibleGuards.length} UNITS
          </div>
        </div>
      )}

      {/* Scale bar */}
      {!minimal && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
          <div className="h-1 w-16 bg-white/70 relative">
            <span className="absolute -top-1 left-0 h-3 w-px bg-white/70" />
            <span className="absolute -top-1 right-0 h-3 w-px bg-white/70" />
          </div>
          <span className="text-[10px] font-mono text-white/70">200 m</span>
        </div>
      )}

      {/* Attribution */}
      {attribution && (
        <div className="absolute bottom-2 right-3 z-20 text-[9px] font-mono text-white/40">
          © GuardOS Maps
        </div>
      )}

      {/* Legend (mini) */}
      {!minimal && !hideControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#1a2638]/95 backdrop-blur border border-white/10 shadow-lg text-[10px] font-mono text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> ACTIVE
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> BREACH
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-400" /> OFFLINE
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-3 rounded-full border border-rose-400" /> GEOFENCE
          </span>
        </div>
      )}
    </div>
  );
}

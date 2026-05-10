# GuardOS — Portable Demo

Self-contained React + Vite prototype of a security workforce platform with
three portals (Guard mobile, Supervisor command center, Client dashboard) and
a Google Maps–style live map with red geofence boundaries, breach alerts and
animated patrol traces. All data is mocked in-memory; no backend or API keys
required.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Demo credentials

All passwords are `demo`.

### Supervisor (command center)
- `rivera@guardos.com` — Captain Rivera
- `park@guardos.com` — Lt. Park

### Guard (mobile)
Badge IDs · PIN `1234`:
- `G-1042` — on-duty patrol
- `G-2088` — on-duty patrol
- `G-1105` — geofence breach demo
- `G-3391` — SOS demo

### Client portal
Site codes · password `demo`:
- `CLI-HELIX`
- `CLI-MERID`
- `CLI-GFRT`
- `CLI-AURORA`

## Stack

React 19 · Vite 7 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zustand
(persisted) · Wouter · Framer Motion · Recharts · Lucide.

## What to look at

- **Supervisor → Dashboard** — live operations grid with clickable guard pins,
  pulsing red geofence boundaries on breach, docked breach panel, and a
  command-center "Selected Unit" inset card.
- **Supervisor → Geofences** — drag a site's perimeter radius and watch guards
  drift outside the ring in real time.
- **Guard mobile** — duty toggle, live GPS map, QR checkpoint scanning, SOS,
  offline event queue.
- **Client portal** — perimeter monitoring view scoped to a single site, plus
  patrol log, incidents, and downloadable reports (mocked).

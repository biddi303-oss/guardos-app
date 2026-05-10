import { Link } from "wouter";
import { Shield, LayoutDashboard, Building2, Radar, Activity, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGuards, getSupervisors, getClients } from "@/lib/db";

export default function Landing() {
  const guards = getGuards();
  const supervisors = getSupervisors();
  const clients = getClients();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-[128px]" />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="z-10 w-full max-w-6xl flex flex-col items-center space-y-10">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10" />
            <Shield className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">GuardOS</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl font-mono">
            Mission-control for modern security operations.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card/40">
              <MapPin className="h-3 w-3 text-primary" /> LIVE GPS
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card/40">
              <Radar className="h-3 w-3 text-primary" /> GEOFENCING
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card/40">
              <Activity className="h-3 w-3 text-primary" /> PATROL ANALYTICS
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <Link href="/guard/login" className="block group">
            <Card className="h-full border-border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors group-hover:border-primary/50 group-hover:shadow-[0_0_30px_-5px_rgba(0,180,216,0.3)] cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Guard App
                  <Badge variant="outline" className="font-mono text-[10px]">MOBILE</Badge>
                </CardTitle>
                <CardDescription>Field operations, patrol tracking, and instant SOS.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Guard ID · PIN 1234</div>
                  <div className="flex flex-wrap gap-1.5">
                    {guards.slice(0, 4).map((g) => (
                      <span key={g.id} className="font-mono text-xs bg-background/60 border border-border rounded px-2 py-0.5">{g.guardId}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/login" className="block group">
            <Card className="h-full border-border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors group-hover:border-primary/50 group-hover:shadow-[0_0_30px_-5px_rgba(0,180,216,0.3)] cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Operations Center
                  <Badge variant="outline" className="font-mono text-[10px]">DESKTOP</Badge>
                </CardTitle>
                <CardDescription>Live dispatch, geofence breach alerts, and workforce command.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Supervisor · password "demo"</div>
                  <div className="flex flex-col gap-1">
                    {supervisors.slice(0, 2).map((s) => (
                      <span key={s.id} className="font-mono text-xs bg-background/60 border border-border rounded px-2 py-0.5 truncate">{s.email}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/client/login" className="block group">
            <Card className="h-full border-border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors group-hover:border-primary/50 group-hover:shadow-[0_0_30px_-5px_rgba(0,180,216,0.3)] cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Client Portal
                  <Badge variant="outline" className="font-mono text-[10px]">DESKTOP</Badge>
                </CardTitle>
                <CardDescription>Transparency and proof-of-service for property managers.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Client code · password "demo"</div>
                  <div className="flex flex-wrap gap-1.5">
                    {clients.slice(0, 2).map((c) => (
                      <span key={c.id} className="font-mono text-xs bg-background/60 border border-border rounded px-2 py-0.5">{c.clientCode}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

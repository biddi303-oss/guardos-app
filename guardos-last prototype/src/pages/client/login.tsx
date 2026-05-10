import { useState } from "react";
import { useLocation } from "wouter";
import { Building2, AlertCircle, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { authClient, getClients } from "@/lib/db";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const setRole = useAppStore((s) => s.setRole);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = authClient(code, password);
    if (!client) {
      setError("Invalid client code or password.");
      return;
    }
    setRole("client", client.id);
    setLocation("/client");
  };

  const clients = getClients();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center mb-6">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">GuardOS</h1>
          <p className="text-sm font-mono text-muted-foreground mt-2">CLIENT PORTAL</p>
        </div>

        <Card className="w-full bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader>
            <CardTitle>Client Sign-In</CardTitle>
            <CardDescription>Use the client code provided by your account manager.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Key className="h-3 w-3" /> Client code or email
                </label>
                <Input
                  placeholder="CLI-HELIX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono bg-background/50 h-11"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 h-11"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded border border-rose-500/40 bg-rose-500/10 text-[11px] text-rose-300">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" variant="secondary" className="w-full mt-2 h-11">
                View Reports
              </Button>
            </form>

            {clients.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Client accounts
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCode(c.clientCode);
                        setPassword("demo");
                        setError(null);
                      }}
                      className="text-left px-3 py-2 rounded border border-border bg-background/40 hover:bg-primary/10 hover:border-primary/40 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">{c.contactEmail}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {c.clientCode}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

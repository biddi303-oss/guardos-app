import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { authSupervisor, getSupervisors } from "@/lib/db";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const setRole = useAppStore((s) => s.setRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sup = authSupervisor(email, password);
    if (!sup) {
      setError("No supervisor account matches those credentials.");
      return;
    }
    setRole("admin", sup.id);
    setLocation("/admin");
  };

  const supervisors = getSupervisors();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10" />
            <Shield className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">GuardOS</h1>
          <p className="text-sm font-mono text-primary mt-2 flex items-center gap-2">
            <Lock className="w-3 h-3" /> OPERATIONS CENTER
          </p>
        </div>

        <Card className="w-full bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader>
            <CardTitle>Supervisor Sign-In</CardTitle>
            <CardDescription>Enter your dispatch credentials to access the live grid.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Supervisor email
                </label>
                <Input
                  type="email"
                  placeholder="supervisor@guardos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 h-11"
                  autoComplete="email"
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
              <Button type="submit" className="w-full mt-2 h-11">
                Access Grid
              </Button>
            </form>

            {supervisors.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Supervisor accounts
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {supervisors.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setEmail(s.email);
                        setPassword("demo");
                        setError(null);
                      }}
                      className="text-left px-3 py-2 rounded border border-border bg-background/40 hover:bg-primary/10 hover:border-primary/40 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">{s.email}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {s.rank.split(" ")[0].toUpperCase()}
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

import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, ScanLine, AlertCircle, Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { signInGuard, guardAuthErrorMessage } from "@/lib/supabase-auth";
import { PhoneFrame } from "@/components/PhoneFrame";

export default function GuardLogin() {
  const [, setLocation] = useLocation();
  const setRole = useAppStore((s) => s.setRole);
  const [guardId, setGuardId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { guard, error: authErr } = await signInGuard(guardId, pin);

    setLoading(false);

    if (authErr || !guard) {
      setError(guardAuthErrorMessage(authErr ?? "invalid-credentials"));
      return;
    }

    // Use the Supabase UUID as the userId so the rest of the app
    // can match against it (GPS tracking, guard detail panel, etc.)
    setRole("guard", guard.id);
    setLocation("/guard");
  };

  return (
    <PhoneFrame>
      <div className="flex flex-col h-full bg-background p-6 justify-center relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">GuardOS</h1>
          <p className="text-sm font-mono text-muted-foreground mt-2">FIELD OPERATIONS</p>
        </div>

        <Card className="z-10 bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              Guard Sign-In
            </CardTitle>
            <CardDescription>
              Enter your Guard ID and PIN to access your shift.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <ScanLine className="h-3 w-3" /> Guard ID
                </label>
                <Input
                  placeholder="GD-001"
                  value={guardId}
                  onChange={(e) => setGuardId(e.target.value.toUpperCase())}
                  className="font-mono bg-background/50 tracking-widest text-center"
                  autoComplete="off"
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="font-mono tracking-[0.5em] bg-background/50 text-center text-xl"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded border border-rose-500/40 bg-rose-500/10 text-[11px] text-rose-300">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                type="submit"
                className="w-full mt-2 h-12 text-base font-medium"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating…</>
                ) : (
                  "Authenticate"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PhoneFrame>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { needsSetup, setupFirstAdmin } from "@/lib/users.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Wisdom Public School Doomra ERP" },
      { name: "description", content: "Secure staff sign-in for the Wisdom Public School Doomra ERP." },
      { property: "og:title", content: "Sign in — Wisdom Public School Doomra ERP" },
      { property: "og:description", content: "Secure staff sign-in for the school ERP." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard" }); });
    needsSetup().then((r) => setSetup(r.needsSetup)).catch(() => {});
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      if (setup) await setupFirstAdmin({ data: { email, password, full_name: name } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (e) {
      setErr((e as Error).message || "Sign in failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary/5 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-extrabold text-primary-foreground">W</div>
          <h1 className="text-lg font-bold">Wisdom Public School – Doomra</h1>
          <p className="text-sm text-muted-foreground">{setup ? "First-time setup: create the admin account" : "Sign in to the school ERP"}</p>
        </div>
        {setup && (
          <div><Label htmlFor="name">Full name</Label><Input id="name" className="h-11" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        )}
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" className="h-11" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" className="h-11" required minLength={setup ? 8 : undefined} autoComplete={setup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Please wait…" : setup ? "Create admin & sign in" : "Sign in"}</Button>
        {!setup && <p className="text-center text-xs text-muted-foreground">Accounts are created by the school admin.</p>}
      </form>
    </div>
  );
}

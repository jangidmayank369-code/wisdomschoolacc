import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { needsSetup, setupFirstAdmin } from "@/lib/users.functions";
import { SchoolLogo } from "@/components/erp/SchoolLogo";
import { WELCOME_EVENT } from "@/components/erp/BrandExperience";

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const metadata = data.user?.user_metadata;
      const displayName = metadata?.full_name ?? metadata?.display_name ?? metadata?.name;
      navigate({ to: "/dashboard" });
      if (data.user) {
        void supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle().then(({ data: profile }) => {
          const actualName = profile?.full_name || displayName;
          window.dispatchEvent(new CustomEvent(WELCOME_EVENT, { detail: typeof actualName === "string" ? actualName.trim() : "" }));
        });
      } else {
        window.dispatchEvent(new CustomEvent(WELCOME_EVENT, { detail: "" }));
      }
    } catch (e) {
      setErr((e as Error).message || "Sign in failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="brand-login flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="text-center">
          <SchoolLogo className="mx-auto h-36 w-36" />
          <h1 className="text-xl font-extrabold text-primary">WPS DOOMRA ERP</h1>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Wisdom Public School – Doomra</p>
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

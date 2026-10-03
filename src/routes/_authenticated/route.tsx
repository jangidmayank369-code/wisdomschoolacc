import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppProvider, useApp } from "@/lib/app-context";
import { AppShell } from "@/components/erp/AppShell";
import { Loading } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  return (
    <AppProvider user={user}>
      <Gate />
    </AppProvider>
  );
}

function Gate() {
  const { loading, roles } = useApp();
  if (loading) return <Loading text="Loading ERP…" />;
  if (!roles.length) return <div className="p-8 text-center text-sm text-muted-foreground">Your account has no role assigned. Please contact the school admin.</div>;
  return <AppShell><Outlet /></AppShell>;
}

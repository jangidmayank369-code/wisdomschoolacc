import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wisdom Public School – Doomra ERP" },
      { name: "description", content: "School management for Wisdom Public School, Doomra: students, fees, staff, payroll, transport and accounts." },
      { property: "og:title", content: "Wisdom Public School – Doomra ERP" },
      { property: "og:description", content: "Students, fees, staff, payroll, transport and accounts in one place." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => navigate({ to: data.session ? "/dashboard" : "/login", replace: true }));
  }, [navigate]);
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Wisdom Public School – Doomra ERP</div>;
}

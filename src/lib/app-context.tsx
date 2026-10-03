import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Untyped client for config-driven (dynamic table) queries. RLS still applies. */
export const db = supabase as unknown as SupabaseClient;

export type Role = "admin" | "accountant" | "staff";
export type AcademicSession = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };

type Ctx = {
  user: User | null;
  roles: Role[];
  staffId: string | null;
  isAdmin: boolean;
  isFinance: boolean;
  sessions: AcademicSession[];
  session: AcademicSession | null;
  setSessionId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
};

const AppCtx = createContext<Ctx | null>(null);
const KEY = "wps.session";

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sid, setSid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [r, s, st] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", user.id),
      db.from("academic_sessions").select("*").order("start_date", { ascending: false }),
      db.from("staff").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    setRoles(((r.data ?? []) as { role: Role }[]).map((x) => x.role));
    const list = (s.data ?? []) as AcademicSession[];
    setSessions(list);
    setStaffId((st.data as { id: string } | null)?.id ?? null);
    const saved = localStorage.getItem(KEY);
    setSid((cur) => {
      const want = cur ?? saved;
      if (want && list.some((x) => x.id === want)) return want;
      return (list.find((x) => x.is_current) ?? list[0])?.id ?? null;
    });
    setLoading(false);
  }, [user.id]);

  useEffect(() => { void reload(); }, [reload]);

  const setSessionId = (id: string) => { localStorage.setItem(KEY, id); setSid(id); };
  const isAdmin = roles.includes("admin");
  const isFinance = isAdmin || roles.includes("accountant");

  return (
    <AppCtx.Provider value={{
      user, roles, staffId, isAdmin, isFinance, sessions,
      session: sessions.find((x) => x.id === sid) ?? null,
      setSessionId, reload, loading,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

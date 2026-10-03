import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** True when no admin exists yet (first-run setup). */
export const needsSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { needsSetup: (count ?? 0) === 0 };
});

const newUser = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
});

async function createAuthUser(input: z.infer<typeof newUser>, role: "admin" | "accountant" | "staff", staffId?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.full_name },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create user");
  const uid = data.user.id;
  await supabaseAdmin.from("profiles").insert({ id: uid, full_name: input.full_name, email: input.email });
  const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role });
  if (rErr) throw new Error(rErr.message);
  if (staffId) {
    const { error: sErr } = await supabaseAdmin.from("staff").update({ user_id: uid }).eq("id", staffId);
    if (sErr) throw new Error(sErr.message);
  }
  return { id: uid };
}

/** First-run only: creates the first admin. Refuses once any admin exists. */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .validator((d) => newUser.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup already completed. Ask the admin for an account.");
    return createAuthUser(data, "admin");
  });

/** Admin creates a login for admin / accountant / staff (optionally linked to a staff record). */
export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => newUser.extend({ role: z.enum(["admin", "accountant", "staff"]), staff_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Only admin can create users");
    return createAuthUser(data, data.role, data.staff_id);
  });

/** Admin: list users with roles */
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Only admin can view users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: staff }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, created_at").order("created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("staff").select("user_id, employee_id, name").not("user_id", "is", null),
    ]);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      staff: (staff ?? []).find((s) => s.user_id === p.id) ?? null,
    }));
  });

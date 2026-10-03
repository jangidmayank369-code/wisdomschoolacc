import { db } from "./app-context";

export type RefKind = "student" | "staff" | "driver" | "vehicle" | "fee_category";
export type RefOption = { id: string; code: string; label: string };
export type RefMaps = Partial<Record<RefKind, RefOption[]>>;

/** Load lookup lists used by forms (dropdowns) and the import engine (code -> id). */
export async function loadRefs(kinds: RefKind[], sessionId: string | null): Promise<RefMaps> {
  const out: RefMaps = {};
  await Promise.all(
    [...new Set(kinds)].map(async (k) => {
      if (k === "student") {
        const { data } = await db.from("students").select("id, admission_no, name").order("admission_no").limit(10000);
        out.student = (data ?? []).map((r) => ({ id: r.id, code: r.admission_no, label: `${r.admission_no} — ${r.name}` }));
      } else if (k === "staff") {
        const { data } = await db.from("staff").select("id, employee_id, name").order("employee_id").limit(5000);
        out.staff = (data ?? []).map((r) => ({ id: r.id, code: r.employee_id, label: `${r.employee_id} — ${r.name}` }));
      } else if (k === "driver") {
        let q = db.from("staff_sessions").select("staff_id, staff(employee_id, name)").ilike("designation", "driver");
        if (sessionId) q = q.eq("session_id", sessionId);
        const { data } = await q;
        // drivers list; fall back to all staff for code lookup in imports
        out.driver = (data ?? []).map((r: { staff_id: string; staff: { employee_id: string; name: string } | null }) => ({
          id: r.staff_id, code: r.staff?.employee_id ?? "", label: `${r.staff?.employee_id} — ${r.staff?.name}`,
        }));
      } else if (k === "vehicle") {
        const { data } = await db.from("vehicles").select("id, vehicle_no, model").order("vehicle_no");
        out.vehicle = (data ?? []).map((r) => ({ id: r.id, code: r.vehicle_no, label: `${r.vehicle_no}${r.model ? " — " + r.model : ""}` }));
      } else if (k === "fee_category") {
        const { data } = await db.from("fee_categories").select("id, name").order("name");
        out.fee_category = (data ?? []).map((r) => ({ id: r.id, code: r.name, label: r.name }));
      }
    }),
  );
  return out;
}

export const findRef = (maps: RefMaps, kind: RefKind, code: string) => {
  const c = code.trim().toLowerCase();
  return maps[kind]?.find((o) => o.code.toLowerCase() === c);
};

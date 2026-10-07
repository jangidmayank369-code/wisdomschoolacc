export const inr = (n: number | string | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Whole rupees for salary presentation; never changes saved amounts. */
export const salaryInr = (n: number | string | null | undefined) =>
  (Math.round(Number(n ?? 0)) < 0 ? "-₹" : "₹") + Math.abs(Number(n ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Display a yyyy-mm-dd date as dd-mm-yyyy */
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

/** "2026-04-01" -> "Apr 2026" */
export const fmtMonth = (d: string | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d.slice(0, 7) + "-01T00:00:00");
  return dt.toLocaleString("en-IN", { month: "short", year: "numeric" });
};

export const monthStart = (d: string) => d.slice(0, 7) + "-01";

export const monthEnd = (d: string) => {
  const [y, m] = d.slice(0, 7).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${d.slice(0, 7)}-${String(last).padStart(2, "0")}`;
};

/** List month starts between two dates (inclusive) */
export const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
};

/** Accepts dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd. Returns yyyy-mm-dd or null */
export const parseDate = (v: string): string | null => {
  const s = (v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

export const errMsg = (e: unknown): string => {
  const anyE = e as { message?: string; code?: string; details?: string };
  if (anyE?.code === "23505") return "Duplicate record: this entry already exists.";
  if (anyE?.code === "42501") return "Permission denied for this action.";
  if (anyE?.code === "23503") return "This record is linked to other data and cannot be removed.";
  return anyE?.message || String(e);
};

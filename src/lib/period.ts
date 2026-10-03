import { today } from "./format";
import type { AcademicSession } from "./app-context";

export type Period = "session" | "today" | "7d" | "month" | "year" | "custom";
export const PERIODS: { v: Period; l: string }[] = [
  { v: "session", l: "Whole session" }, { v: "today", l: "Today" }, { v: "7d", l: "Last 7 days" },
  { v: "month", l: "This month" }, { v: "year", l: "This year" }, { v: "custom", l: "Custom" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function periodRange(p: Period, s: AcademicSession | null, custom: { from: string; to: string }) {
  const t = today();
  const now = new Date();
  switch (p) {
    case "today": return { from: t, to: t };
    case "7d": return { from: iso(new Date(now.getTime() - 6 * 864e5)), to: t };
    case "month": return { from: t.slice(0, 7) + "-01", to: t };
    case "year": return { from: t.slice(0, 4) + "-01-01", to: t };
    case "custom": return { from: custom.from || s?.start_date || t, to: custom.to || t };
    default: return { from: s?.start_date ?? "1900-01-01", to: s?.end_date ?? "2999-12-31" };
  }
}

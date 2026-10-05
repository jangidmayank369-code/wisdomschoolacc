import { num } from "./format";

/** School rule: every month is exactly 30 days. */
export const DAYS_PER_MONTH = 30;
export const ABSENT_WARNING_DAYS = 4;

export const dailySalary = (monthly: number) => Math.round((num(monthly) / DAYS_PER_MONTH) * 100) / 100;

export type AttendanceRow = { date: string; status: string };

export function attendanceSummary(rows: AttendanceRow[]) {
  const s = { present: 0, absent: 0, half_day: 0, leave: 0 };
  for (const r of rows) if (r.status in s) s[r.status as keyof typeof s]++;
  return s;
}

/**
 * Absence deduction rule (approved leave is never counted as absence):
 * 0–1 absent → 0 days; 2 → 1; 3 → 2; 4 → 3;
 * >4 absent → pay only actual payable days (30 − absent − half days × 0.5).
 */
export function deductionDays(absent: number, halfDays: number) {
  if (absent <= 1) return 0;
  if (absent <= ABSENT_WARNING_DAYS) return absent - 1;
  return absent + halfDays * 0.5;
}

export type AttendanceOverride = { present: number; absent: number; half_day: number; leave: number; payableDays?: number | null };

/** Salary from counts (used by payroll + historical correction). */
export function salaryFromCounts(monthly: number, absent: number, halfDays: number, payableDays?: number | null, eligibleDays = DAYS_PER_MONTH) {
  const deduction = deductionDays(absent, halfDays);
  const cap = Math.min(DAYS_PER_MONTH, Math.max(0, eligibleDays));
  const paidDays = payableDays != null ? Math.min(cap, Math.max(0, payableDays)) : Math.max(0, cap - deduction);
  const calculated = Math.max(0, Math.round((num(monthly) / DAYS_PER_MONTH) * paidDays * 100) / 100);
  return { deduction, paidDays, calculated };
}

/** Payroll for one staff member and one month (fixed 30-day month). */
export function payrollRow(opts: {
  monthlySalary: number;
  dueOverride?: number | null;
  attendance: AttendanceRow[];
  override?: AttendanceOverride | null;
  paid: number;
  eligibleDays?: number;
}) {
  const a = opts.override ? { present: opts.override.present, absent: opts.override.absent, half_day: opts.override.half_day, leave: opts.override.leave } : attendanceSummary(opts.attendance);
  const monthly = num(opts.monthlySalary);
  const daily = dailySalary(monthly);
  const eligibleDays = opts.eligibleDays ?? DAYS_PER_MONTH;
  const { deduction, paidDays, calculated } = salaryFromCounts(monthly, a.absent, a.half_day, opts.override?.payableDays, eligibleDays);
  const due = opts.dueOverride != null ? num(opts.dueOverride) : calculated;
  const paid = num(opts.paid);
  return {
    monthly,
    daily,
    workingDays: eligibleDays,
    ...a,
    deduction,
    paidDays,
    calculated,
    attendanceAmount: calculated,
    due,
    paid,
    balance: Math.max(0, Math.round((due - paid) * 100) / 100),
    warning: a.absent > ABSENT_WARNING_DAYS,
    corrected: !!opts.override,
  };
}

export const sum = <T,>(rows: T[], f: (r: T) => unknown) => rows.reduce((s, r) => s + num(f(r)), 0);

/** Whole KM, effective average and litres; retain the saved rate and round only the monetary result. */
export const fuelEstimate = (km: number, kmpl: number | null | undefined, ratePerLitre: number | null | undefined) => {
  const roundedKm = Math.round(num(km));
  const average = Math.floor(num(kmpl));
  const rate = ratePerLitre == null ? null : num(ratePerLitre);
  const litres = average > 0 ? Math.floor(roundedKm / average) : null;
  const cost = litres != null && rate != null && rate >= 0 ? Math.round(litres * rate * 100) / 100 : null;
  return { km: roundedKm, average: average > 0 ? average : null, litres, rate, cost };
};

const later = (...dates: string[]) => dates.reduce((a, b) => a > b ? a : b);
const earlier = (...dates: string[]) => dates.reduce((a, b) => a < b ? a : b);
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Inclusive employment overlap in a payroll month, capped by the fixed 30-day salary month. */
export function employmentMonthEligibility(opts: {
  joiningDate?: string | null;
  exitDate?: string | null;
  employmentStatus?: string | null;
  sessionStart: string;
  sessionEnd: string;
  monthStart: string;
}) {
  const monthLast = (() => {
    const [y, m] = opts.monthStart.slice(0, 7).split("-").map(Number);
    return `${opts.monthStart.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  })();
  const start = later(opts.joiningDate ?? opts.sessionStart, opts.sessionStart, opts.monthStart);
  const end = earlier(opts.exitDate ?? opts.sessionEnd, opts.sessionEnd, monthLast);
  const statusAllowsPayroll = opts.employmentStatus !== "inactive";
  const rawDays = statusAllowsPayroll && start <= end ? Math.floor((utcDay(end) - utcDay(start)) / 86_400_000) + 1 : 0;
  // A full employment month is 30 salary days, even in February.
  const fullMonth = statusAllowsPayroll && start <= opts.monthStart && end >= monthLast;
  const eligibleDays = fullMonth ? DAYS_PER_MONTH : Math.min(DAYS_PER_MONTH, Math.max(0, rawDays));
  return { eligible: eligibleDays > 0, eligibleDays, start, end };
}

export function payrollEligible(joiningDate: string | null | undefined, staffStatus: string | null | undefined, monthStart: string, exitDate?: string | null) {
  if (staffStatus === "inactive") return false;
  const monthLast = monthStart.slice(0, 7) + "-31";
  return (!joiningDate || joiningDate <= monthLast) && (!exitDate || exitDate >= monthStart);
}

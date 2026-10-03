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
export function salaryFromCounts(monthly: number, absent: number, halfDays: number, payableDays?: number | null) {
  const deduction = deductionDays(absent, halfDays);
  const paidDays = payableDays != null ? Math.min(DAYS_PER_MONTH, Math.max(0, payableDays)) : Math.max(0, DAYS_PER_MONTH - deduction);
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
}) {
  const a = opts.override ? { present: opts.override.present, absent: opts.override.absent, half_day: opts.override.half_day, leave: opts.override.leave } : attendanceSummary(opts.attendance);
  const monthly = num(opts.monthlySalary);
  const daily = dailySalary(monthly);
  const { deduction, paidDays, calculated } = salaryFromCounts(monthly, a.absent, a.half_day, opts.override?.payableDays);
  const due = opts.dueOverride != null ? num(opts.dueOverride) : calculated;
  const paid = num(opts.paid);
  return {
    monthly,
    daily,
    workingDays: DAYS_PER_MONTH,
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

export const fuelSummary = (totalKm: number, ratePerKm: number, actualPaid: number) => {
  const estimated = Math.round(num(totalKm) * num(ratePerKm) * 100) / 100;
  return { estimated, actual: num(actualPaid), variance: Math.round((estimated - num(actualPaid)) * 100) / 100 };
};

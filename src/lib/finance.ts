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
 * Payroll for one staff member and one month.
 * Working days = 30. Approved leave counts as paid. Half day = 0.5 absent.
 * Salary is NOT auto-deducted: due = monthly salary (or payroll override).
 * "Attendance-based amount" is shown for reference with a warning when absent > 4.
 */
export function payrollRow(opts: {
  monthlySalary: number;
  dueOverride?: number | null;
  attendance: AttendanceRow[];
  paid: number;
}) {
  const a = attendanceSummary(opts.attendance);
  const daily = dailySalary(opts.monthlySalary);
  const paidDays = Math.max(0, DAYS_PER_MONTH - a.absent - a.half_day * 0.5);
  const due = opts.dueOverride != null ? num(opts.dueOverride) : num(opts.monthlySalary);
  const paid = num(opts.paid);
  return {
    monthly: num(opts.monthlySalary),
    daily,
    workingDays: DAYS_PER_MONTH,
    ...a,
    paidDays,
    attendanceAmount: Math.round(paidDays * daily * 100) / 100,
    due,
    paid,
    balance: Math.round((due - paid) * 100) / 100,
    warning: a.absent > ABSENT_WARNING_DAYS,
  };
}

export const sum = <T,>(rows: T[], f: (r: T) => unknown) => rows.reduce((s, r) => s + num(f(r)), 0);

export const fuelSummary = (totalKm: number, ratePerKm: number, actualPaid: number) => {
  const estimated = Math.round(num(totalKm) * num(ratePerKm) * 100) / 100;
  return { estimated, actual: num(actualPaid), variance: Math.round((estimated - num(actualPaid)) * 100) / 100 };
};

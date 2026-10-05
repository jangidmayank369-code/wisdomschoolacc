import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { monthEnd, today, fmtMonth, inr, salaryInr } from "@/lib/format";
import { payrollRow, salaryFromCounts, dailySalary, sum, employmentMonthEligibility } from "@/lib/finance";
import { downloadCsv } from "@/lib/csv";
import { getModule, type Column, type Field, type Row } from "@/lib/modules";
import { DataTable } from "@/components/erp/DataTable";
import { FormDialog } from "@/components/erp/FormDialog";
import { Empty, ErrorState, Loading, PageHeader, StatCard, StatGrid } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [
    { title: "Payroll — WPS Doomra ERP" }, { name: "description", content: "Session payroll, attendance deductions, eligible days and salary payments for Wisdom Public School." },
    { property: "og:title", content: "Payroll — WPS Doomra ERP" }, { property: "og:description", content: "Session payroll and salary payments for Wisdom Public School." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Payroll,
});

const cols: Column[] = [
  { key: "name", label: "Staff" }, { key: "designation", label: "Designation" },
  { key: "monthly", label: "Monthly", render: (r) => salaryInr(r.monthly) }, { key: "daily", label: "Daily", render: (r) => salaryInr(r.daily) },
  { key: "workingDays", label: "Working" }, { key: "present", label: "Present" },
  { key: "absent", label: "Absent", render: (r) => <span className={r.warning ? "font-bold text-destructive" : ""}>{r.absent}{r.warning ? " ⚠ >4" : ""}</span> },
  { key: "half_day", label: "Half" }, { key: "leave", label: "Leave" }, { key: "deduction", label: "Deduct days" }, { key: "paidDays", label: "Payable days" },
  { key: "calculated", label: "Calculated", render: (r) => <>{salaryInr(r.calculated)}{r.corrected ? " ✎" : ""}</> },
  { key: "due", label: "Due", render: (r) => salaryInr(r.due) }, { key: "paid", label: "Paid", render: (r) => salaryInr(r.paid) }, { key: "balance", label: "Balance", render: (r) => salaryInr(r.balance) },
  { key: "review", label: "Review", value: (r) => r.review ? "Payroll after exit — Admin review" : "" },
];

const payFieldsList: Field[] = [
  { name: "salary_days", label: "Salary days / days to pay", type: "number", required: true },
  ...getModule("staff_payments")!.fields.filter((f) => f.name !== "staff_id" && f.name !== "payroll_month").map((f) => f.name === "amount" ? { ...f, label: "Amount to pay (₹, editable)" } : f),
];
const corrFields: Field[] = [
  { name: "present_days", label: "Present days", type: "number", required: true },
  { name: "absent_days", label: "Absent days", type: "number", required: true },
  { name: "half_days", label: "Half days", type: "number", required: true },
  { name: "leave_days", label: "Approved leave days", type: "number", required: true },
  { name: "payable_days", label: "Payable days (blank = by rule)", type: "number" },
  { name: "reason", label: "Reason for correction", type: "text", required: true },
];

function Payroll() {
  const { session, user, isAdmin } = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [pay, setPay] = useState<Row | null>(null);
  const [days, setDays] = useState("");
  const [fix, setFix] = useState<Row | null>(null);
  const gross = pay ? Math.round(dailySalary(pay.monthly) * Math.min(Number(days) || 0, pay.eligibleDays) * 100) / 100 : 0;
  const payRecord = useMemo(() => pay ? { salary_days: days, amount: Math.max(0, Math.min(gross, pay.due) - pay.paid), paid_by: user?.email ?? "" } : null, [pay, days, gross, user]);
  const m0 = month + "-01";
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["mod", "payroll", sid, month],
    enabled: !!sid,
    queryFn: async () => {
      const [ss, att, pays, pp] = await Promise.all([
        db.from("staff_sessions").select("*, staff(employee_id, name, status), academic_sessions(start_date, end_date)").eq("session_id", sid),
        db.from("staff_attendance").select("staff_id, date, status").eq("session_id", sid).gte("date", m0).lte("date", monthEnd(m0)),
        db.from("staff_payments").select("staff_id, amount").eq("session_id", sid).eq("payroll_month", m0).eq("is_reversed", false),
        db.from("payroll_periods").select("*").eq("session_id", sid).eq("month", m0),
      ]);
      if (ss.error) throw ss.error;
      return (ss.data ?? []).map((s) => {
        const eligibility = employmentMonthEligibility({ joiningDate: s.joining_date, exitDate: s.exit_date, employmentStatus: s.status,
          sessionStart: s.academic_sessions.start_date, sessionEnd: s.academic_sessions.end_date, monthStart: m0 });
        const period = (pp.data ?? []).find((p) => p.staff_id === s.staff_id);
        const staffPays = (pays.data ?? []).filter((p) => p.staff_id === s.staff_id);
        const historical = !!period || staffPays.length > 0;
        if (!eligibility.eligible && !historical) return null;
        const calculationDays = !eligibility.eligible && historical ? 30 : eligibility.eligibleDays;
        return {
        id: s.staff_id, staff_id: s.staff_id, name: `${s.staff?.name} (${s.staff?.employee_id})`, designation: s.designation,
        eligibleDays: calculationDays, canPay: eligibility.eligible, exit_date: s.exit_date,
        review: !!s.exit_date && m0.slice(0, 7) > s.exit_date.slice(0, 7) && historical,
        ...payrollRow({
          monthlySalary: Number(s.monthly_salary),
          dueOverride: period?.salary_due ?? null,
          override: period && period.present_days != null ? { present: Number(period.present_days), absent: Number(period.absent_days ?? 0), half_day: Number(period.half_days ?? 0), leave: Number(period.leave_days ?? 0), payableDays: period.payable_days != null ? Number(period.payable_days) : null } : null,
          attendance: (att.data ?? []).filter((a) => a.staff_id === s.staff_id),
          paid: sum(staffPays, (p) => p.amount), eligibleDays: calculationDays,
        }),
      }}).filter((r): r is NonNullable<typeof r> => r != null);
    },
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Payroll" subtitle={`${session?.name ?? "—"} · ${fmtMonth(m0)} · 1 month = 30 days`} actions={
        <>
          <Input type="month" className="h-10 w-[160px]" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`payroll_${month}.csv`, cols.map((c) => c.label), rows.map((r) => cols.map((c) => (r as Row)[c.key])))}>Export</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
        </>
      } />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : !rows.length ? <Empty text="No active staff employment in this session." /> : (
        <>
          <StatGrid>
            <StatCard label="Total due" value={salaryInr(sum(rows, (r) => r.due))} />
            <StatCard label="Total paid" value={salaryInr(sum(rows, (r) => r.paid))} tone="good" />
            <StatCard label="Balance" value={salaryInr(sum(rows, (r) => r.balance))} tone="warn" />
            <StatCard label="Absence warnings" value={rows.filter((r) => r.warning).length} tone={rows.some((r) => r.warning) ? "bad" : undefined} />
          </StatGrid>
          <DataTable columns={cols} rows={rows} rowClass={(r) => (r.review ? "bg-destructive/10" : r.warning ? "bg-warning/10" : "")}
            onRowClick={(r) => nav({ to: "/staff/$id", params: { id: r.staff_id } })}
            actions={(r) => <span className="flex gap-3">
              {r.balance > 0 && r.canPay && !r.review ? <button className="text-sm font-semibold text-primary underline" onClick={() => { setDays(String(r.paidDays)); setPay(r); }}>Pay</button> : r.review ? <span className="text-xs font-semibold text-destructive">Review</span> : !r.canPay ? <span className="text-xs text-muted-foreground">Historical</span> : <span className="text-xs text-success">Paid</span>}
              {isAdmin && <button className="text-sm text-primary underline" onClick={() => setFix(r)}>Correct attendance</button>}
            </span>} />
        </>
      )}
      <FormDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} title={`Pay salary — ${pay?.name ?? ""} · ${fmtMonth(m0)}`}
        fields={payFieldsList} record={payRecord} refs={{}} submitLabel="Confirm & pay"
        intro={pay && (
          <div className="space-y-2"><label className="block text-xs font-medium">Salary days / days to pay (recalculates amount)
            <Input type="number" min={0} max={30} step="0.5" className="mt-1 h-10" value={days} onChange={(e) => setDays(e.target.value)} /></label>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
            {([["Employee", pay.name], ["Designation", pay.designation], ["Month", fmtMonth(m0)], ["Monthly salary", salaryInr(pay.monthly)],
              ["Daily salary (÷30)", salaryInr(pay.daily)], ["Eligible days", `${pay.eligibleDays} / 30`], ["Payable days by rule", `${pay.paidDays} / ${pay.eligibleDays}`], ["Present days", pay.present], ["Absent days", pay.absent],
              ["Approved leave", pay.leave], ["Half days", pay.half_day], ["Deduction days", pay.deduction], ["Salary days entered", days || "0"],
              ["Gross payable (daily × days)", salaryInr(gross)], ["Previously paid", salaryInr(pay.paid)], ["Remaining after gross", salaryInr(Math.max(0, gross - pay.paid))],
              ["Month salary limit", salaryInr(pay.due)]] as [string, unknown][]).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{String(v ?? "—")}</dd></div>
            ))}
            <p className="col-span-2 mt-1 text-xs text-muted-foreground">Rule: 0–1 absent no deduction · 2→1 day · 3→2 · 4→3 · more than 4 → only payable days. Amount to pay below can be changed by admin (partial allowed).</p>
          </dl></div>
        )}
        onSubmit={async (v) => {
          if (!(Number(v.amount) > 0)) throw new Error("Amount must be greater than zero");
          if (!confirm(`Pay ${inr(v.amount)} to ${pay!.name} for ${fmtMonth(m0)}?`)) throw new Error("Cancelled — nothing saved");
           const sd = Number(days) || 0;
           if (sd <= 0 || sd > pay!.eligibleDays) throw new Error(`Salary days must be between 0.5 and ${pay!.eligibleDays}`);
          const { error } = await db.from("staff_payments").insert({ ...v, salary_days: sd, staff_id: pay!.staff_id, session_id: sid, payroll_month: m0, calculated_amount: gross, client_token: crypto.randomUUID(),
            remarks: [v.remarks, `${sd} days × ${inr(pay!.daily)} = ${salaryInr(gross)}`, Number(v.amount) !== gross - pay!.paid ? `Paid ${inr(v.amount)} (manual)` : null].filter(Boolean).join(" · ") });
          if (error) throw error;
          toast.success("Salary payment recorded");
          qc.invalidateQueries({ queryKey: ["mod"] }); qc.invalidateQueries({ queryKey: ["dash"] }); qc.invalidateQueries({ queryKey: ["profile"] });
        }} />
      <FormDialog open={!!fix} onOpenChange={(o) => !o && setFix(null)} title={`Attendance / salary correction — ${fix?.name ?? ""} · ${fmtMonth(m0)}`}
        fields={corrFields} refs={{}} submitLabel="Save correction"
        record={fix && { present_days: fix.present, absent_days: fix.absent, half_days: fix.half_day, leave_days: fix.leave }}
        intro={<p className="text-sm text-muted-foreground">For months where daily attendance is missing or wrong. Salary is recalculated with the 30-day rule (0–1 absent no cut · 2→1 · 3→2 · 4→3 · more than 4 → payable days). Daily attendance records are not changed.</p>}
        onSubmit={async (v) => {
           const r = salaryFromCounts(fix!.monthly, v.absent_days, v.half_days, v.payable_days, fix!.eligibleDays);
          if (r.calculated < fix!.paid) throw new Error(`Already paid ${inr(fix!.paid)} is more than the corrected salary ${inr(r.calculated)}. Reverse or correct a payment first.`);
          if (!confirm(`Save correction? Payable days ${r.paidDays}, salary ${inr(r.calculated)}.`)) throw new Error("Cancelled — nothing saved");
          const { error } = await db.from("payroll_periods").upsert({
            staff_id: fix!.staff_id, session_id: sid, month: m0, salary_due: r.calculated,
            present_days: v.present_days, absent_days: v.absent_days, half_days: v.half_days, leave_days: v.leave_days, payable_days: v.payable_days,
            change_reason: `${v.reason} (by ${user?.email} at ${new Date().toLocaleString("en-IN")})`, corrected_by: user?.id, corrected_at: new Date().toISOString(),
          }, { onConflict: "staff_id,session_id,month" });
          if (error) throw error;
          toast.success("Attendance corrected; salary recalculated");
          qc.invalidateQueries({ queryKey: ["mod"] });
        }} />
    </div>
  );
}

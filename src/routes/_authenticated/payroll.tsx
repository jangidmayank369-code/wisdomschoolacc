import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { monthEnd, today, fmtMonth, inr } from "@/lib/format";
import { payrollRow, sum } from "@/lib/finance";
import { downloadCsv } from "@/lib/csv";
import { getModule, type Column, type Row } from "@/lib/modules";
import { DataTable } from "@/components/erp/DataTable";
import { FormDialog } from "@/components/erp/FormDialog";
import { Empty, ErrorState, Loading, PageHeader, StatCard, StatGrid } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — WPS Doomra ERP" }] }),
  component: Payroll,
});

const cols: Column[] = [
  { key: "name", label: "Staff" }, { key: "designation", label: "Designation" },
  { key: "monthly", label: "Monthly", money: true }, { key: "daily", label: "Daily", money: true },
  { key: "workingDays", label: "Working" }, { key: "present", label: "Present" },
  { key: "absent", label: "Absent", render: (r) => <span className={r.warning ? "font-bold text-destructive" : ""}>{r.absent}{r.warning ? " ⚠ >4" : ""}</span> },
  { key: "half_day", label: "Half" }, { key: "leave", label: "Leave" }, { key: "deduction", label: "Deduct days" }, { key: "paidDays", label: "Payable days" },
  { key: "calculated", label: "Calculated", money: true },
  { key: "due", label: "Due", money: true }, { key: "paid", label: "Paid", money: true }, { key: "balance", label: "Balance", money: true },
];

function Payroll() {
  const { session, user } = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [pay, setPay] = useState<Row | null>(null);
  const m0 = month + "-01";
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["mod", "payroll", sid, month],
    enabled: !!sid,
    queryFn: async () => {
      const [ss, att, pays, pp] = await Promise.all([
        db.from("staff_sessions").select("*, staff(employee_id, name)").eq("session_id", sid).eq("status", "active"),
        db.from("staff_attendance").select("staff_id, date, status").eq("session_id", sid).gte("date", m0).lte("date", monthEnd(m0)),
        db.from("staff_payments").select("staff_id, amount").eq("session_id", sid).eq("payroll_month", m0).eq("is_reversed", false),
        db.from("payroll_periods").select("staff_id, salary_due").eq("session_id", sid).eq("month", m0),
      ]);
      if (ss.error) throw ss.error;
      return (ss.data ?? []).map((s) => ({
        id: s.staff_id, staff_id: s.staff_id, name: `${s.staff?.name} (${s.staff?.employee_id})`, designation: s.designation,
        ...payrollRow({
          monthlySalary: Number(s.monthly_salary),
          dueOverride: (pp.data ?? []).find((p) => p.staff_id === s.staff_id)?.salary_due ?? null,
          attendance: (att.data ?? []).filter((a) => a.staff_id === s.staff_id),
          paid: sum((pays.data ?? []).filter((p) => p.staff_id === s.staff_id), (p) => p.amount),
        }),
      }));
    },
  });

  const rows = q.data ?? [];
  const payFieldsList = getModule("staff_payments")!.fields.filter((f) => f.name !== "staff_id" && f.name !== "payroll_month").map((f) => f.name === "amount" ? { ...f, label: "Amount to pay (₹)" } : f);

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
            <StatCard label="Total due" value={sum(rows, (r) => r.due)} money />
            <StatCard label="Total paid" value={sum(rows, (r) => r.paid)} money tone="good" />
            <StatCard label="Balance" value={sum(rows, (r) => r.balance)} money tone="warn" />
            <StatCard label="Absence warnings" value={rows.filter((r) => r.warning).length} tone={rows.some((r) => r.warning) ? "bad" : undefined} />
          </StatGrid>
          <DataTable columns={cols} rows={rows} rowClass={(r) => (r.warning ? "bg-warning/10" : "")}
            onRowClick={(r) => nav({ to: "/staff/$id", params: { id: r.staff_id } })}
            actions={(r) => r.balance > 0 ? <button className="text-sm font-semibold text-primary underline" onClick={() => setPay(r)}>Pay</button> : <span className="text-xs text-success">Paid</span>} />
        </>
      )}
      <FormDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} title={`Pay salary — ${pay?.name ?? ""} · ${fmtMonth(m0)}`}
        fields={payFieldsList} record={pay ? { amount: pay.balance, paid_by: user?.email ?? "" } : null} refs={{}} submitLabel="Confirm & pay"
        intro={pay && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
            {([["Employee", pay.name], ["Designation", pay.designation], ["Month", fmtMonth(m0)], ["Monthly salary", inr(pay.monthly)],
              ["Daily salary (÷30)", inr(pay.daily)], ["Payable days", `${pay.paidDays} / 30`], ["Present days", pay.present], ["Absent days", pay.absent],
              ["Approved leave", pay.leave], ["Half days", pay.half_day], ["Deduction days", pay.deduction], ["Calculated salary", inr(pay.calculated)],
              ["Salary due", inr(pay.due)], ["Already paid", inr(pay.paid)], ["Remaining balance", inr(pay.balance)]] as [string, unknown][]).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{String(v ?? "—")}</dd></div>
            ))}
            <p className="col-span-2 mt-1 text-xs text-muted-foreground">Rule: 0–1 absent no deduction · 2→1 day · 3→2 · 4→3 · more than 4 → only payable days. Amount to pay below can be changed by admin (partial allowed).</p>
          </dl>
        )}
        onSubmit={async (v) => {
          if (!(Number(v.amount) > 0)) throw new Error("Amount must be greater than zero");
          if (!confirm(`Pay ${inr(v.amount)} to ${pay!.name} for ${fmtMonth(m0)}?`)) throw new Error("Cancelled — nothing saved");
          const { error } = await db.from("staff_payments").insert({ ...v, staff_id: pay!.staff_id, session_id: sid, payroll_month: m0, calculated_amount: pay!.calculated, client_token: crypto.randomUUID(),
            remarks: [v.remarks, Number(v.amount) !== pay!.balance ? `Manual amount; calculated ${inr(pay!.calculated)}` : null].filter(Boolean).join(" · ") || null });
          if (error) throw error;
          toast.success("Salary payment recorded");
          qc.invalidateQueries({ queryKey: ["mod"] }); qc.invalidateQueries({ queryKey: ["dash"] });
        }} />
    </div>
  );
}

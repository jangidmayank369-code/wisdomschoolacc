import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { db, useApp } from "@/lib/app-context";
import { fmtDate, fmtMonth, inr, monthEnd, monthsBetween, today } from "@/lib/format";
import { dailySalary, fuelSummary, payrollRow, sum } from "@/lib/finance";
import type { Column, Row } from "@/lib/modules";
import { DataTable } from "./DataTable";
import { ResourcePage } from "./ResourcePage";
import { Empty, ErrorState, Loading, PageHeader, Section, StatCard, StatGrid } from "./States";

const monthCols: Column[] = [
  { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "due", label: "Due", money: true }, { key: "paid", label: "Paid", money: true }, { key: "balance", label: "Balance", money: true },
  { key: "present", label: "P" }, { key: "absent", label: "A", render: (r) => <span className={r.warning ? "font-bold text-destructive" : ""}>{r.absent}{r.warning ? " ⚠" : ""}</span> },
  { key: "half_day", label: "Half" }, { key: "leave", label: "Leave" }, { key: "paidDays", label: "Paid days" },
];
const histCols: Column[] = [
  { key: "session", label: "Session" }, { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "due", label: "Due", money: true }, { key: "paid", label: "Paid", money: true }, { key: "balance", label: "Balance", money: true },
];
const ledgerCols: Column[] = [
  { key: "date", label: "Date", render: (r) => fmtDate(r.date) }, { key: "kind", label: "Type" },
  { key: "detail", label: "Detail" }, { key: "amount", label: "Amount", render: (r) => (r.amount == null ? "" : inr(r.amount)) },
];

/** Staff profile; also used for Driver profile (driver=true) and the staff's own dashboard. */
export function StaffProfileView({ staffId, driver, self }: { staffId: string; driver?: boolean; self?: boolean }) {
  const { session } = useApp();
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["profile", "staff", staffId, sid],
    queryFn: async () => {
      const [st, ss, pays, pp, att, va, km, fuel] = await Promise.all([
        db.from("staff").select("*").eq("id", staffId).single(),
        db.from("staff_sessions").select("*, academic_sessions(name, start_date, end_date)").eq("staff_id", staffId),
        db.from("staff_payments").select("*").eq("staff_id", staffId).eq("is_reversed", false),
        db.from("payroll_periods").select("*").eq("staff_id", staffId),
        sid ? db.from("staff_attendance").select("date, status").eq("staff_id", staffId).eq("session_id", sid) : Promise.resolve({ data: [], error: null }),
        sid ? db.from("vehicle_assignments").select("*, vehicles(vehicle_no, model)").eq("staff_id", staffId).eq("session_id", sid).maybeSingle() : Promise.resolve({ data: null, error: null }),
        driver && sid ? db.from("driver_km_logs").select("date, km, vehicles(vehicle_no)").eq("staff_id", staffId).eq("session_id", sid).order("date") : Promise.resolve({ data: [], error: null }),
        driver && sid ? db.from("transport_expenses").select("date, amount, expense_type, mode, paid_by").eq("staff_id", staffId).eq("session_id", sid).eq("is_reversed", false) : Promise.resolve({ data: [], error: null }),
      ]);
      const err = st.error ?? ss.error ?? pays.error ?? pp.error ?? att.error;
      if (err) throw err;
      return { staff: st.data as Row, sessions: (ss.data ?? []) as Row[], pays: (pays.data ?? []) as Row[], pp: (pp.data ?? []) as Row[],
        att: (att.data ?? []) as Row[], va: va.data as Row | null, km: (km.data ?? []) as Row[], fuel: (fuel.data ?? []) as Row[] };
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const d = q.data!;
  const s = d.staff;

  // Complete history across all sessions (each month belongs to exactly one session)
  const nowMonth = today();
  const history: Row[] = [];
  for (const ses of d.sessions) {
    const a = ses.academic_sessions;
    const start = ses.joining_date && ses.joining_date > a.start_date ? ses.joining_date : a.start_date;
    const end = a.end_date < nowMonth ? a.end_date : nowMonth;
    if (start > end) continue;
    for (const month of monthsBetween(start, end)) {
      const over = d.pp.find((p) => p.session_id === ses.session_id && p.month === month);
      const paid = sum(d.pays.filter((p) => p.session_id === ses.session_id && p.payroll_month === month), (p) => p.amount);
      const due = over ? Number(over.salary_due) : Number(ses.monthly_salary);
      history.push({ id: ses.session_id + month, session: a.name, session_id: ses.session_id, month, due, paid, balance: due - paid });
    }
  }
  const cur = d.sessions.find((x) => x.session_id === sid);
  const curMonths: Row[] = history.filter((h) => h.session_id === sid).map((h) => ({
    ...payrollRow({
      monthlySalary: Number(cur?.monthly_salary ?? 0), dueOverride: h.due,
      attendance: d.att.filter((a) => a.date >= h.month && a.date <= monthEnd(h.month)), paid: h.paid,
    }), id: h.id, month: h.month,
  }));
  const tot = { due: sum(curMonths, (r) => r.due), paid: sum(curMonths, (r) => r.paid) };
  const all = { due: sum(history, (r) => r.due), paid: sum(history, (r) => r.paid) };

  const totalKm = sum(d.km, (r) => r.km);
  const thisMonthKm = sum(d.km.filter((r) => r.date.slice(0, 7) === nowMonth.slice(0, 7)), (r) => r.km);
  const fuelPaid = sum(d.fuel.filter((f) => String(f.expense_type).toLowerCase() === "fuel"), (f) => f.amount);
  const fuelS = fuelSummary(totalKm, Number(d.va?.fuel_rate_per_km ?? 0), fuelPaid);
  const todayAtt = d.att.find((a) => a.date === today());

  const ledger: Row[] = driver ? [
    ...d.pays.filter((p) => p.session_id === sid).map((p) => ({ date: p.payment_date, kind: "SALARY PAYMENT", detail: `${fmtMonth(p.payroll_month)} · ${p.mode}${p.paid_by ? " · " + p.paid_by : ""}`, amount: p.amount })),
    ...d.km.map((k) => ({ date: k.date, kind: "KM", detail: `${k.km} KM · ${k.vehicles?.vehicle_no ?? ""}`, amount: null })),
    ...d.fuel.map((f) => ({ date: f.date, kind: String(f.expense_type).toUpperCase(), detail: `${f.mode}${f.paid_by ? " · " + f.paid_by : ""}`, amount: f.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r, i) => ({ ...r, id: i }) as Row) : [];

  return (
    <div className="space-y-6">
      <PageHeader title={s.name} subtitle={<>Emp ID {s.employee_id} · {s.mobile || "no mobile"}{s.email ? ` · ${s.email}` : ""}{s.address ? ` · ${s.address}` : ""}</>} />

      {!cur ? (
        <Empty text={`No employment record in session ${session?.name ?? ""}. Add one under Employment.`} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Designation" value={cur.designation} />
            <StatCard label="Joining date" value={fmtDate(cur.joining_date) || "—"} />
            <StatCard label="Monthly salary" value={cur.monthly_salary} money />
            <StatCard label="Daily salary (÷30)" value={dailySalary(cur.monthly_salary)} money />
            <StatCard label="Salary due (session)" value={tot.due} money />
            <StatCard label="Salary paid" value={tot.paid} money tone="good" />
            <StatCard label="Salary balance" value={tot.due - tot.paid} money tone={tot.due - tot.paid > 0 ? "warn" : undefined} />
            {self && <StatCard label="Today's attendance" value={todayAtt?.status ?? "Not marked"} />}
          </StatGrid>
          {curMonths.some((m) => m.warning) && (
            <p className="flex items-center gap-2 rounded-md bg-warning/15 p-2 text-sm"><AlertTriangle className="h-4 w-4" />Absent more than 4 days in some months. Salary is not auto-deducted — review before paying.</p>
          )}
        </>
      )}

      {driver && cur && (
        <Section title="Vehicle, KM & fuel">
          <StatGrid>
            <StatCard label="Vehicle" value={d.va?.vehicles?.vehicle_no ?? "Not assigned"} />
            <StatCard label="Route" value={d.va?.route || "—"} />
            <StatCard label="KM this month" value={thisMonthKm} />
            <StatCard label="Total session KM" value={totalKm} />
            <StatCard label="Days driven" value={d.km.length} />
            <StatCard label="Avg KM/day" value={d.km.length ? Math.round((totalKm / d.km.length) * 10) / 10 : 0} />
            <StatCard label="Fuel rate / KM" value={Number(d.va?.fuel_rate_per_km ?? 0)} money />
            <StatCard label="Estimated fuel" value={fuelS.estimated} money />
            <StatCard label="Actual fuel paid" value={fuelS.actual} money />
            <StatCard label="Variance (est − actual)" value={fuelS.variance} money tone={fuelS.variance < 0 ? "bad" : "good"} />
          </StatGrid>
        </Section>
      )}

      {cur && (
        <Section title={`Monthly salary — ${session?.name}`}>
          {curMonths.length ? <DataTable columns={monthCols} rows={curMonths} rowClass={(r) => (r.warning ? "bg-warning/10" : "")} /> : <Empty text="No salary months yet in this session." />}
        </Section>
      )}

      <Section title="Session history">
        {d.sessions.length ? (
          <DataTable rows={d.sessions.map((x) => ({ ...x, id: x.id }))} columns={[
            { key: "s", label: "Session", value: (r) => r.academic_sessions?.name }, { key: "joining_date", label: "Joining", render: (r) => fmtDate(r.joining_date) },
            { key: "designation", label: "Designation" }, { key: "monthly_salary", label: "Salary", money: true },
            { key: "daily", label: "Daily", value: (r) => inr(dailySalary(r.monthly_salary)) }, { key: "status", label: "Status" },
          ]} />
        ) : <Empty text="No employment records" />}
      </Section>

      <Section title={`Complete salary history · Due ${inr(all.due)} · Paid ${inr(all.paid)} · Balance ${inr(all.due - all.paid)}`}>
        {history.length ? <DataTable columns={histCols} rows={[...history].reverse()} pageSize={12} /> : <Empty />}
      </Section>

      <ResourcePage embedded moduleKey="staff_payments" where={{ staff_id: staffId }} title="Salary payments (selected session)" />
      {driver && <ResourcePage embedded moduleKey="driver_km_logs" where={{ staff_id: staffId }} title="Daily KM" />}
      {driver && <ResourcePage embedded moduleKey="transport_expenses" where={{ staff_id: staffId }} title="Fuel payments" />}
      {driver && (
        <Section title="Transport ledger (chronological)">
          {ledger.length ? <DataTable columns={ledgerCols} rows={ledger} /> : <Empty />}
        </Section>
      )}
      <ResourcePage embedded moduleKey="staff_attendance" where={{ staff_id: staffId }} title="Attendance" />
      <ResourcePage embedded moduleKey="leave_requests" where={{ staff_id: staffId }} title="Leave requests" />
    </div>
  );
}

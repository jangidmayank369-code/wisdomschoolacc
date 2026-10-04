import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { db, useApp } from "@/lib/app-context";
import { fmtDate, fmtMonth, inr, monthEnd, monthsBetween, today } from "@/lib/format";
import { dailySalary, employmentMonthEligibility, fuelEstimate, payrollRow, sum } from "@/lib/finance";
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
  { key: "credit", label: "Credit / overpayment", money: true },
];
const driverMonthCols: Column[] = [
  { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "salaryDue", label: "Salary Due", money: true }, { key: "salaryPaid", label: "Salary Paid", money: true }, { key: "salaryBalance", label: "Salary Balance", money: true },
  { key: "fuelEstimated", label: "Fuel Estimated", render: (r) => r.fuelEstimated == null ? "Fuel rate not set" : inr(r.fuelEstimated) },
  { key: "fuelPaid", label: "Fuel Paid", money: true }, { key: "fuelBalance", label: "Fuel Balance", render: (r) => r.fuelBalance == null ? "—" : inr(r.fuelBalance) },
];

/** Staff profile; also used for Driver profile (driver=true) and the staff's own dashboard. */
export function StaffProfileView({ staffId, driver, self }: { staffId: string; driver?: boolean; self?: boolean }) {
  const { session } = useApp();
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["profile", "staff", staffId, sid, "transport-v2"],
    queryFn: async () => {
      const [st, ss, pays, pp, att, va, km, fuel, rates] = await Promise.all([
        db.from("staff").select("*").eq("id", staffId).single(),
        db.from("staff_sessions").select("*, academic_sessions(name, start_date, end_date)").eq("staff_id", staffId),
        db.from("staff_payments").select("*").eq("staff_id", staffId).eq("is_reversed", false),
        db.from("payroll_periods").select("*").eq("staff_id", staffId),
        sid ? db.from("staff_attendance").select("date, status").eq("staff_id", staffId).eq("session_id", sid) : Promise.resolve({ data: [], error: null }),
        sid ? db.from("vehicle_assignments").select("*, vehicles(vehicle_no, model, fuel_average_kmpl)").eq("staff_id", staffId).eq("session_id", sid).maybeSingle() : Promise.resolve({ data: null, error: null }),
        driver && sid ? db.from("monthly_vehicle_km").select("month, total_km, vehicles(vehicle_no, fuel_average_kmpl)").eq("staff_id", staffId).eq("session_id", sid).order("month") : Promise.resolve({ data: [], error: null }),
        driver && sid ? db.from("transport_expenses").select("date, amount, expense_type, mode, paid_by").eq("staff_id", staffId).eq("session_id", sid).eq("is_reversed", false) : Promise.resolve({ data: [], error: null }),
        driver && sid ? db.from("fuel_rates").select("month, fuel_type, rate_per_litre").eq("session_id", sid).eq("status", "active") : Promise.resolve({ data: [], error: null }),
      ]);
      const err = st.error ?? ss.error ?? pays.error ?? pp.error ?? att.error ?? va.error ?? km.error ?? fuel.error ?? rates.error;
      if (err) throw err;
      return { staff: st.data as Row, sessions: (ss.data ?? []) as Row[], pays: (pays.data ?? []) as Row[], pp: (pp.data ?? []) as Row[],
        att: (att.data ?? []) as Row[], va: va.data as Row | null, km: (km.data ?? []) as Row[], fuel: (fuel.data ?? []) as Row[], rates: (rates.data ?? []) as Row[] };
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <ErrorState error={new Error("Staff profile data is unavailable")} />;
  // Keep profiles safe across refreshes and cached data created before transport fields were added.
  const d = {
    ...q.data,
    sessions: q.data.sessions ?? [],
    pays: q.data.pays ?? [],
    pp: q.data.pp ?? [],
    att: q.data.att ?? [],
    km: q.data.km ?? [],
    fuel: q.data.fuel ?? [],
    rates: q.data.rates ?? [],
  };
  const s = d.staff;

  // Complete history across all sessions (each month belongs to exactly one session)
  const nowMonth = today();
  const history: Row[] = [];
  for (const ses of d.sessions) {
    const a = ses.academic_sessions;
    const start = ses.joining_date && ses.joining_date > a.start_date ? ses.joining_date : a.start_date;
    const sessionEnd = ses.exit_date && ses.exit_date < a.end_date ? ses.exit_date : a.end_date;
    const end = sessionEnd < nowMonth ? sessionEnd : nowMonth;
    if (start > end) continue;
    for (const month of monthsBetween(start, end)) {
      const over = d.pp.find((p) => p.session_id === ses.session_id && p.month === month);
      const paid = sum(d.pays.filter((p) => p.session_id === ses.session_id && p.payroll_month === month), (p) => p.amount);
      const eligibility = employmentMonthEligibility({ joiningDate: ses.joining_date, exitDate: ses.exit_date, employmentStatus: ses.status === "inactive" ? "active" : ses.status,
        sessionStart: a.start_date, sessionEnd: a.end_date, monthStart: month });
      const due = over ? Number(over.salary_due) : Math.round(dailySalary(Number(ses.monthly_salary)) * eligibility.eligibleDays * 100) / 100;
      history.push({ id: ses.session_id + month, session: a.name, session_id: ses.session_id, month, due, paid, balance: Math.max(0, due - paid), credit: Math.max(0, paid - due), eligibleDays: eligibility.eligibleDays });
    }
  }
  const cur = d.sessions.find((x) => x.session_id === sid);
  const curMonths: Row[] = history.filter((h) => h.session_id === sid).map((h) => ({
    ...payrollRow({
      monthlySalary: Number(cur?.monthly_salary ?? 0), dueOverride: h.due,
       attendance: d.att.filter((a) => a.date >= h.month && a.date <= monthEnd(h.month)) as { date: string; status: string }[], paid: h.paid, eligibleDays: h.eligibleDays,
    }), id: h.id, month: h.month,
  }));
  const tot = { due: sum(curMonths, (r) => r.due), paid: sum(curMonths, (r) => r.paid) };
  const all = { due: sum(history, (r) => r.due), paid: sum(history, (r) => r.paid) };
  const postExitReview = d.sessions.flatMap((employment) => {
    if (!employment.exit_date) return [];
    const exitMonth = employment.exit_date.slice(0, 7);
    const periods = d.pp.filter((p) => p.session_id === employment.session_id && p.month.slice(0, 7) > exitMonth);
    const payments = d.pays.filter((p) => p.session_id === employment.session_id && p.payroll_month.slice(0, 7) > exitMonth);
    return [...periods.map((p) => `Payroll ${fmtMonth(p.month)}`), ...payments.map((p) => `Payment ${fmtMonth(p.payroll_month)}`)];
  });

  const fuelPaid = sum(d.fuel.filter((f) => String(f.expense_type).toLowerCase() === "fuel"), (f) => f.amount);
  let estimatedFuelCost = 0;
  let missingRateMonths = 0;
  const fuelByMonth = new Map<string, Row>();
  d.km.forEach((kmRow) => {
    const month = kmRow.month.slice(0, 7);
    const monthRates = d.rates.filter((r) => r.month.slice(0, 7) === month);
    const rate = monthRates.length === 1 ? monthRates[0] : undefined;
    const est = fuelEstimate(Number(kmRow.total_km), kmRow.vehicles?.fuel_average_kmpl, rate?.rate_per_litre == null ? null : Number(rate.rate_per_litre));
    if (est.cost != null) estimatedFuelCost += est.cost; else missingRateMonths++;
    fuelByMonth.set(month, { estimated: est.cost });
  });
  d.fuel.filter((f) => String(f.expense_type).toLowerCase() === "fuel").forEach((f) => {
    const month = f.date.slice(0, 7);
    const row = fuelByMonth.get(month) ?? { estimated: 0 };
    row.paid = Number(row.paid ?? 0) + Number(f.amount);
    fuelByMonth.set(month, row);
  });
  const salaryBalance = Math.max(0, tot.due - tot.paid);
  const salaryCredit = Math.max(0, tot.paid - tot.due);
  const fuelBalance = missingRateMonths ? null : Math.max(0, estimatedFuelCost - fuelPaid);
  const fuelCredit = missingRateMonths ? null : Math.max(0, fuelPaid - estimatedFuelCost);
  const driverMonths = [...new Set([...curMonths.map((m) => m.month.slice(0, 7)), ...fuelByMonth.keys()])].sort().map((month) => {
    const salary = curMonths.find((m) => m.month.slice(0, 7) === month);
    const fuelMonth = fuelByMonth.get(month) ?? {};
    const fuelEstimated = fuelMonth.estimated == null ? null : Number(fuelMonth.estimated);
    const monthFuelPaid = Number(fuelMonth.paid ?? 0);
    return { id: month, month: `${month}-01`, salaryDue: Number(salary?.due ?? 0), salaryPaid: Number(salary?.paid ?? 0), salaryBalance: Math.max(0, Number(salary?.due ?? 0) - Number(salary?.paid ?? 0)),
      fuelEstimated, fuelPaid: monthFuelPaid, fuelBalance: fuelEstimated == null ? null : Math.max(0, fuelEstimated - monthFuelPaid) };
  });
  const todayAtt = d.att.find((a) => a.date === today());

  return (
    <div className="space-y-6">
      <PageHeader title={s.name} subtitle={<>Emp ID {s.employee_id} · {s.mobile || "no mobile"}{s.email ? ` · ${s.email}` : ""}{s.address ? ` · ${s.address}` : ""}</>} />

      {!cur ? (
        <Empty text={`No employment record in session ${session?.name ?? ""}. Add one under Employment.`} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Primary designation" value={cur.designation} />
            <StatCard label="Optional role" value={cur.optional_role || "—"} />
            <StatCard label="Joining date" value={fmtDate(cur.joining_date) || "—"} />
            <StatCard label="Exit date" value={fmtDate(cur.exit_date) || "—"} />
            {!driver && <StatCard label="Monthly salary" value={cur.monthly_salary} money />}
            {!driver && <StatCard label="Daily salary (÷30)" value={dailySalary(cur.monthly_salary)} money />}
            {!driver && <StatCard label="Salary due (session)" value={tot.due} money />}
            {!driver && <StatCard label="Salary paid" value={tot.paid} money tone="good" />}
            {!driver && <StatCard label="Salary balance" value={tot.due - tot.paid} money tone={tot.due - tot.paid > 0 ? "warn" : undefined} />}
            {self && <StatCard label="Today's attendance" value={todayAtt?.status ?? "Not marked"} />}
          </StatGrid>
          {curMonths.some((m) => m.warning) && (
            <p className="flex items-center gap-2 rounded-md bg-warning/15 p-2 text-sm"><AlertTriangle className="h-4 w-4" />Absent more than 4 days in some months. Pay only for actual payable days in those months — review before paying.</p>
          )}
           {postExitReview.length > 0 && (
             <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{postExitReview.length} historical payroll item(s) after an exit date require Admin review. Nothing was changed.</p>
           )}
        </>
      )}

      {driver && cur && (
        <Section title={`Driver balance — ${session?.name}`}>
          <StatGrid>
            <StatCard label="Salary Balance" value={salaryBalance} money tone={salaryBalance > 0 ? "warn" : undefined} />
            <StatCard label="Fuel Balance" value={fuelBalance == null ? "Fuel rate not set" : fuelBalance} money={fuelBalance != null} tone={fuelBalance != null && fuelBalance > 0 ? "warn" : undefined} />
            <StatCard label="Total Balance" value={fuelBalance == null ? "Fuel rate not set" : salaryBalance + fuelBalance} money={fuelBalance != null} tone={fuelBalance != null && salaryBalance + fuelBalance > 0 ? "warn" : undefined} />
            {salaryCredit > 0 && <StatCard label="Salary Credit" value={salaryCredit} money tone="good" />}
            {fuelCredit != null && fuelCredit > 0 && <StatCard label="Fuel Credit" value={fuelCredit} money tone="good" />}
          </StatGrid>
          {driverMonths.length ? <DataTable columns={driverMonthCols} rows={driverMonths} /> : <Empty text="No data available" />}
        </Section>
      )}

      {cur && (
        <Section title={`Monthly salary — ${session?.name}`}>
          {curMonths.length ? <DataTable columns={monthCols} rows={curMonths} rowClass={(r) => (r.warning ? "bg-warning/10" : "")} /> : <Empty text="No salary months yet in this session." />}
        </Section>
      )}

      {self ? (
        <Section title="Employment history">
          {d.sessions.length ? (
            <DataTable rows={d.sessions.map((x) => ({ ...x, id: x.id }))} columns={[
              { key: "s", label: "Session", value: (r) => r.academic_sessions?.name }, { key: "category", label: "Category" },
              { key: "designation", label: "Designation" }, { key: "optional_role", label: "Optional Role" }, { key: "monthly_salary", label: "Salary", money: true },
               { key: "joining_date", label: "Joining", render: (r) => fmtDate(r.joining_date) }, { key: "exit_date", label: "Exit", render: (r) => fmtDate(r.exit_date) }, { key: "status", label: "Status" },
            ]} />
          ) : <Empty text="No employment records" />}
        </Section>
      ) : (
        <ResourcePage moduleKey="staff_sessions" where={{ staff_id: staffId }} embedded allSessions title="Employment history (all sessions)" />
      )}

      <Section title={`Complete salary history · Due ${inr(all.due)} · Paid ${inr(all.paid)} · Balance ${inr(all.due - all.paid)}`}>
        {history.length ? <DataTable columns={histCols} rows={[...history].reverse()} pageSize={12} /> : <Empty />}
      </Section>

      <ResourcePage embedded moduleKey="staff_payments" where={{ staff_id: staffId }} title="Salary payments (selected session)" />
      {driver && <ResourcePage embedded moduleKey="monthly_vehicle_km" where={{ staff_id: staffId }} title="Monthly KM" />}
      {driver && <ResourcePage embedded moduleKey="transport_expenses" where={{ staff_id: staffId }} title="Fuel payments" />}
      <ResourcePage embedded moduleKey="staff_attendance" where={{ staff_id: staffId }} title="Attendance" />
      <ResourcePage embedded moduleKey="leave_requests" where={{ staff_id: staffId }} title="Leave requests" />
    </div>
  );
}

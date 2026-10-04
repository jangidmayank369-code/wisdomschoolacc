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
      const [st, ss, pays, pp, att, va, km, fuel, rates] = await Promise.all([
        db.from("staff").select("*").eq("id", staffId).single(),
        db.from("staff_sessions").select("*, academic_sessions(name, start_date, end_date)").eq("staff_id", staffId),
        db.from("staff_payments").select("*").eq("staff_id", staffId).eq("is_reversed", false),
        db.from("payroll_periods").select("*").eq("staff_id", staffId),
        sid ? db.from("staff_attendance").select("date, status").eq("staff_id", staffId).eq("session_id", sid) : Promise.resolve({ data: [], error: null }),
        sid ? db.from("vehicle_assignments").select("*, vehicles(vehicle_no, model, fuel_average_kmpl)").eq("staff_id", staffId).eq("session_id", sid).maybeSingle() : Promise.resolve({ data: null, error: null }),
        driver && sid ? db.from("driver_km_logs").select("date, km, vehicles(vehicle_no)").eq("staff_id", staffId).eq("session_id", sid).order("date") : Promise.resolve({ data: [], error: null }),
        driver && sid ? db.from("transport_expenses").select("date, amount, expense_type, mode, paid_by").eq("staff_id", staffId).eq("session_id", sid).eq("is_reversed", false) : Promise.resolve({ data: [], error: null }),
        driver && sid ? db.from("fuel_rates").select("month, fuel_type, rate_per_litre").eq("session_id", sid).eq("status", "active") : Promise.resolve({ data: [], error: null }),
      ]);
      const err = st.error ?? ss.error ?? pays.error ?? pp.error ?? att.error;
      if (err) throw err;
      return { staff: st.data as Row, sessions: (ss.data ?? []) as Row[], pays: (pays.data ?? []) as Row[], pp: (pp.data ?? []) as Row[],
        att: (att.data ?? []) as Row[], va: va.data as Row | null, km: (km.data ?? []) as Row[], fuel: (fuel.data ?? []) as Row[], rates: (rates.data ?? []) as Row[] };
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

  const totalKm = Math.round(sum(d.km, (r) => r.km));
  const thisMonthKm = Math.round(sum(d.km.filter((r) => r.date.slice(0, 7) === nowMonth.slice(0, 7)), (r) => r.km));
  const fuelPaid = sum(d.fuel.filter((f) => String(f.expense_type).toLowerCase() === "fuel"), (f) => f.amount);
  const kmpl = d.va?.vehicles?.fuel_average_kmpl ?? null;
  const kmByMonth = new Map<string, number>();
  d.km.forEach((r) => kmByMonth.set(r.date.slice(0, 7), (kmByMonth.get(r.date.slice(0, 7)) ?? 0) + Number(r.km)));
  let estimatedFuelCost = 0;
  let estimatedLitres = 0;
  let missingRateMonths = 0;
  kmByMonth.forEach((km, month) => {
    const monthRates = d.rates.filter((r) => r.month.slice(0, 7) === month);
    const rate = monthRates.length === 1 ? monthRates[0] : monthRates.find((r) => r.fuel_type === "Diesel");
    const est = fuelEstimate(km, kmpl, rate?.rate_per_litre == null ? null : Number(rate.rate_per_litre));
    if (est.litres != null) estimatedLitres += est.litres;
    if (est.cost != null) estimatedFuelCost += est.cost; else missingRateMonths++;
  });
  estimatedLitres = Math.round(estimatedLitres * 100) / 100;
  estimatedFuelCost = Math.round(estimatedFuelCost * 100) / 100;
  const salaryPaid = sum(d.pays.filter((p) => p.session_id === sid), (p) => p.amount);
  const actualTransport = sum(d.fuel, (f) => f.amount);
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
            <StatCard label="Primary designation" value={cur.designation} />
            <StatCard label="Optional role" value={cur.optional_role || "—"} />
            <StatCard label="Joining date" value={fmtDate(cur.joining_date) || "—"} />
            <StatCard label="Exit date" value={fmtDate(cur.exit_date) || "—"} />
            <StatCard label="Monthly salary" value={cur.monthly_salary} money />
            <StatCard label="Daily salary (÷30)" value={dailySalary(cur.monthly_salary)} money />
            <StatCard label="Salary due (session)" value={tot.due} money />
            <StatCard label="Salary paid" value={tot.paid} money tone="good" />
            <StatCard label="Salary balance" value={tot.due - tot.paid} money tone={tot.due - tot.paid > 0 ? "warn" : undefined} />
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
        <Section title="Vehicle, KM & fuel">
          <StatGrid>
            <StatCard label="Vehicle" value={d.va?.vehicles?.vehicle_no ?? "Not assigned"} />
            <StatCard label="Route" value={d.va?.route || "—"} />
            <StatCard label="KM this month" value={thisMonthKm} />
            <StatCard label="Total session KM" value={totalKm} />
            <StatCard label="Days driven" value={d.km.length} />
            <StatCard label="Avg KM/day" value={d.km.length ? Math.round((totalKm / d.km.length) * 10) / 10 : 0} />
            <StatCard label="Vehicle average" value={kmpl ? `${kmpl} KM/L` : "Not set"} />
             <StatCard label="Estimated fuel (L)" value={kmpl ? estimatedLitres : "Vehicle average not set"} />
             <StatCard label="Estimated fuel cost" value={missingRateMonths || !kmpl ? "Fuel rate not set" : inr(estimatedFuelCost)} />
            <StatCard label="Actual fuel paid" value={fuelPaid} money />
             <StatCard label="Fuel Cost Difference" value={missingRateMonths || !kmpl ? "—" : inr(fuelPaid - estimatedFuelCost)} />
             <StatCard label="Salary paid" value={salaryPaid} money />
             <StatCard label="Actual operating cost" value={salaryPaid + actualTransport} money />
             <StatCard label="Analytical cost with estimate" value={missingRateMonths || !kmpl ? "—" : inr(salaryPaid + estimatedFuelCost)} />
          </StatGrid>
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

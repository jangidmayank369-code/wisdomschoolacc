import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { db, useApp } from "@/lib/app-context";
import { fmtDate, fmtMonth, monthEnd, monthsBetween, salaryInr, today } from "@/lib/format";
import { dailySalary, employmentMonthEligibility, fuelEstimate, isSalaryMonthPayable, payrollRow, sum } from "@/lib/finance";
import type { Column, Row } from "@/lib/modules";
import { DataTable } from "./DataTable";
import { ResourcePage } from "./ResourcePage";
import { Empty, ErrorState, Loading, PageHeader, Section, StatCard, StatGrid } from "./States";

const monthCols: Column[] = [
  { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "due", label: "Salary Due", render: (r) => salaryInr(r.due) }, { key: "paid", label: "Salary Paid", render: (r) => salaryInr(r.paid) }, { key: "balance", label: "Salary Balance", render: (r) => salaryInr(r.balance) },
  { key: "present", label: "P" }, { key: "absent", label: "A", render: (r) => <span className={r.warning ? "font-bold text-destructive" : ""}>{r.absent}{r.warning ? " ⚠" : ""}</span> },
  { key: "half_day", label: "Half" }, { key: "leave", label: "Leave" }, { key: "paidDays", label: "Paid days" },
];
const histCols: Column[] = [
  { key: "session", label: "Session" }, { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "due", label: "Due", render: (r) => salaryInr(r.due) }, { key: "paid", label: "Paid", render: (r) => salaryInr(r.paid) }, { key: "balance", label: "Balance", render: (r) => salaryInr(r.balance) },
  { key: "credit", label: "Credit / overpayment", render: (r) => salaryInr(r.credit) },
];
const driverMonthCols: Column[] = [
  { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
  { key: "salaryDue", label: "Salary Due", render: (r) => salaryInr(r.salaryDue) }, { key: "salaryPaid", label: "Salary Paid", render: (r) => salaryInr(r.salaryPaid) }, { key: "salaryBalance", label: "Salary Balance", render: (r) => salaryInr(r.salaryBalance) },
  { key: "fuelEstimated", label: "Fuel Estimated Cost", render: (r) => r.fuelEstimated == null ? "Fuel rate not set" : salaryInr(r.fuelEstimated) },
  { key: "fuelPaid", label: "Fuel Paid", render: (r) => salaryInr(r.fuelPaid) }, { key: "fuelBalance", label: "Fuel Balance", render: (r) => r.fuelBalance == null ? "—" : salaryInr(r.fuelBalance) },
  { key: "fuelCredit", label: "Fuel Credit", render: (r) => r.fuelCredit > 0 ? salaryInr(r.fuelCredit) : "—" },
];

/** Staff profile; also used for Driver profile (driver=true) and the staff's own dashboard. */
export function StaffProfileView({ staffId, driver, self }: { staffId: string; driver?: boolean; self?: boolean }) {
  const { session } = useApp();
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["profile", "staff", staffId, sid, "financial-v4"],
    queryFn: async () => {
      const [st, ss, pays, pp, att, va, km, fuel, rates] = await Promise.all([
        db.from("staff").select("*").eq("id", staffId).single(),
        db.from("staff_sessions").select("*, academic_sessions(name, start_date, end_date)").eq("staff_id", staffId),
        db.from("staff_payments").select("*").eq("staff_id", staffId).eq("is_reversed", false),
        db.from("payroll_periods").select("*").eq("staff_id", staffId),
        sid ? db.from("staff_attendance").select("date, status").eq("staff_id", staffId).eq("session_id", sid) : Promise.resolve({ data: [], error: null }),
        sid ? db.from("vehicle_assignments").select("*, vehicles(vehicle_no, model, fuel_average_kmpl)").eq("staff_id", staffId).eq("session_id", sid).maybeSingle() : Promise.resolve({ data: null, error: null }),
        sid ? db.from("monthly_vehicle_km").select("month, total_km, vehicle_id, vehicles(vehicle_no, fuel_average_kmpl)").eq("staff_id", staffId).eq("session_id", sid).order("month") : Promise.resolve({ data: [], error: null }),
        sid ? db.from("transport_expenses").select("date, for_month, amount, expense_type, staff_id, vehicle_id").eq("session_id", sid).eq("is_reversed", false).limit(5000) : Promise.resolve({ data: [], error: null }),
        sid ? db.from("fuel_rates").select("month, fuel_type, rate_per_litre").eq("session_id", sid).eq("status", "active") : Promise.resolve({ data: [], error: null }),
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
      const monthPays = d.pays.filter((p) => p.session_id === ses.session_id && p.payroll_month === month);
      // Salary cycle: a month is due only once payable (next month) unless admin saved it or a payment exists.
      if (!isSalaryMonthPayable(month, nowMonth) && !over && !monthPays.length) continue;
      const paid = sum(monthPays, (p) => p.amount);
      const eligibility = employmentMonthEligibility({ joiningDate: ses.joining_date, exitDate: ses.exit_date, employmentStatus: ses.status === "inactive" ? "active" : ses.status,
        sessionStart: a.start_date, sessionEnd: a.end_date, monthStart: month });
      const due = over ? Number(over.salary_due) : ses.session_id === sid
        ? payrollRow({ monthlySalary: Number(ses.monthly_salary), eligibleDays: eligibility.eligibleDays,
            attendance: d.att.filter((row) => row.date >= month && row.date <= monthEnd(month)) as { date: string; status: string }[], paid: 0 }).calculated
        : Math.round(dailySalary(Number(ses.monthly_salary)) * eligibility.eligibleDays * 100) / 100;
      history.push({ id: ses.session_id + month, session: a.name, session_id: ses.session_id, month, due, paid, balance: due - paid, credit: Math.max(0, paid - due), eligibleDays: eligibility.eligibleDays });
    }
  }
  const cur = d.sessions.find((x) => x.session_id === sid);
  const curMonths: Row[] = history.filter((h) => h.session_id === sid).map((h) => ({
    ...payrollRow({
      monthlySalary: Number(cur?.monthly_salary ?? 0), dueOverride: h.due,
       attendance: d.att.filter((a) => a.date >= h.month && a.date <= monthEnd(h.month)) as { date: string; status: string }[], paid: h.paid, eligibleDays: h.eligibleDays,
    }), id: h.id, month: h.month, balance: h.balance,
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

  const isDriver = cur?.designation?.toLowerCase() === "driver" || cur?.optional_role?.toLowerCase() === "driver";
  const vehicleIds = new Set<string>([d.va?.vehicle_id, ...d.km.map((row) => row.vehicle_id)].filter(Boolean));
  const driverFuel = isDriver ? d.fuel.filter((f) => f.expense_type?.toLowerCase() === "fuel" && ((f.vehicle_id && vehicleIds.has(f.vehicle_id)) || (!f.vehicle_id && f.staff_id === staffId))) : [];
  const fuelPaid = sum(driverFuel, (f) => f.amount);
  // Only explicitly staff-linked non-fuel expenses; free-text ledger parties are not identities.
  const otherPaid = sum(d.fuel.filter((f) => f.staff_id === staffId && f.expense_type?.toLowerCase() !== "fuel"), (f) => f.amount);
  let estimatedFuelCost = 0;
  let missingRateMonths = 0;
  const fuelByMonth = new Map<string, Row>();
  d.km.forEach((kmRow) => {
    const month = kmRow.month.slice(0, 7);
    const monthRates = d.rates.filter((r) => r.month.slice(0, 7) === month);
    const rate = monthRates.length === 1 ? monthRates[0] : undefined;
    const est = fuelEstimate(Number(kmRow.total_km), kmRow.vehicles?.fuel_average_kmpl, rate?.rate_per_litre == null ? null : Number(rate.rate_per_litre));
    if (est.cost != null) estimatedFuelCost += est.cost; else missingRateMonths++;
    const previous = fuelByMonth.get(month);
    fuelByMonth.set(month, { ...previous, estimated: est.cost == null || previous?.estimated === null ? null : Number(previous?.estimated ?? 0) + est.cost });
  });
  driverFuel.forEach((f) => {
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
      fuelEstimated, fuelPaid: monthFuelPaid, fuelBalance: fuelEstimated == null ? null : Math.max(0, fuelEstimated - monthFuelPaid), fuelCredit: fuelEstimated == null ? 0 : Math.max(0, monthFuelPaid - fuelEstimated) };
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
            <StatCard label="Monthly salary" value={salaryInr(cur.monthly_salary)} />
            <StatCard label="Daily salary (÷30)" value={salaryInr(dailySalary(cur.monthly_salary))} />
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

      {cur && <Section title="Staff Financial Summary">
        <div className="space-y-4">
          <div><h3 className="mb-2 text-sm font-semibold">Salary</h3><StatGrid>
            <StatCard label="Total Salary Due" value={salaryInr(tot.due)} />
            <StatCard label="Paid" value={salaryInr(tot.paid)} tone="good" />
            <StatCard label="Balance" value={salaryInr(salaryBalance)} tone={salaryBalance > 0 ? "warn" : undefined} />
          </StatGrid>{salaryCredit > 0 && <p className="mt-2 text-sm">Salary Credit / Overpayment: {salaryInr(salaryCredit)}</p>}</div>
          {isDriver && <div><h3 className="mb-2 text-sm font-semibold">Fuel / Transport</h3><StatGrid>
            <StatCard label="Total Fuel Cost" value={missingRateMonths ? "Fuel rate not set" : salaryInr(estimatedFuelCost)} />
            <StatCard label="Paid" value={salaryInr(fuelPaid)} tone="good" />
            <StatCard label="Balance" value={fuelBalance == null ? "Fuel rate not set" : salaryInr(fuelBalance)} tone={fuelBalance != null && fuelBalance > 0 ? "warn" : undefined} />
          </StatGrid>{fuelCredit != null && fuelCredit > 0 && <p className="mt-2 text-sm">Fuel Credit: {salaryInr(fuelCredit)}</p>}</div>}
          <div><h3 className="mb-2 text-sm font-semibold">Other Payments</h3><StatGrid>
            <StatCard label="Paid (staff-linked)" value={salaryInr(otherPaid)} />
            <StatCard label="Other Payment Balance" value="Not recorded" />
          </StatGrid><p className="mt-2 text-xs text-muted-foreground">No separate amount due is recorded for these payments; no other balance is assumed.</p></div>
          <div className="border-t pt-3"><StatCard label="Total Outstanding" value={isDriver && fuelBalance == null ? "Fuel rate not set" : salaryInr(salaryBalance + (isDriver ? (fuelBalance ?? 0) : 0))} tone="warn" /></div>
        </div>
      </Section>}

      {isDriver && cur && <Section title="Vehicle / Transport Details">
        <p className="text-sm">{d.va?.vehicles?.vehicle_no ?? "No vehicle assigned"} · {d.va?.route ?? "No route"} · Average {d.va?.vehicles?.fuel_average_kmpl ?? "—"} KM/L</p>
        {driverMonths.length ? <DataTable columns={driverMonthCols} rows={driverMonths} /> : <Empty text="No monthly transport data" />}
      </Section>}

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
               { key: "designation", label: "Designation" }, { key: "optional_role", label: "Optional Role" }, { key: "monthly_salary", label: "Salary", render: (r) => salaryInr(r.monthly_salary) },
               { key: "joining_date", label: "Joining", render: (r) => fmtDate(r.joining_date) }, { key: "exit_date", label: "Exit", render: (r) => fmtDate(r.exit_date) }, { key: "status", label: "Status" },
            ]} />
          ) : <Empty text="No employment records" />}
        </Section>
      ) : (
        <ResourcePage moduleKey="staff_sessions" where={{ staff_id: staffId }} embedded allSessions title="Employment history (all sessions)" />
      )}

       <Section title={`Complete salary history · Due ${salaryInr(all.due)} · Paid ${salaryInr(all.paid)} · Balance ${salaryInr(Math.max(0, all.due - all.paid))}`}>
        {history.length ? <DataTable columns={histCols} rows={[...history].reverse()} pageSize={12} /> : <Empty />}
      </Section>

      <ResourcePage embedded moduleKey="staff_payments" where={{ staff_id: staffId }} title="Salary payments (selected session)" />
       {isDriver && <ResourcePage embedded moduleKey="monthly_vehicle_km" where={{ staff_id: staffId }} title="Monthly KM" />}
       {isDriver && <ResourcePage embedded moduleKey="transport_expenses" where={{ staff_id: staffId }} title="Fuel payments" />}
      <ResourcePage embedded moduleKey="staff_attendance" where={{ staff_id: staffId }} title="Attendance" />
      <ResourcePage embedded moduleKey="leave_requests" where={{ staff_id: staffId }} title="Leave requests" />
    </div>
  );
}

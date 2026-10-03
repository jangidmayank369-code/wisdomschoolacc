import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Wallet, Clock, TrendingUp, TrendingDown, Scale, Users, UserCheck, Plus } from "lucide-react";
import { db, useApp } from "@/lib/app-context";
import { periodRange, type Period } from "@/lib/period";
import { sum } from "@/lib/finance";
import { inr, num, fmtDate } from "@/lib/format";
import { PeriodFilter } from "@/components/erp/PeriodFilter";
import { Empty, ErrorState, Loading, PageHeader, Section } from "@/components/erp/States";
import { Button } from "@/components/ui/button";
import { DashCharts } from "@/components/erp/DashCharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — WPS Doomra ERP" },
    { name: "description", content: "Session fees, collections, expenses, salary and pending fees for Wisdom Public School, Doomra." },
    { property: "og:title", content: "Dashboard — WPS Doomra ERP" },
    { property: "og:description", content: "Real session totals for fees, expenses and salary." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
});

type Who = "admin" | "finance";
const QUICK: { to: string; l: string; who: Who }[] = [
  { to: "/m/students", l: "Add Student", who: "finance" }, { to: "/m/fee_payments", l: "Collect Fee", who: "finance" },
  { to: "/m/student_charges", l: "Add Manual Fee", who: "admin" }, { to: "/payroll", l: "Pay Salary", who: "admin" },
  { to: "/m/expenses", l: "Add Expense", who: "finance" }, { to: "/attendance", l: "Mark Attendance", who: "admin" },
  { to: "/m/staff", l: "Add Staff", who: "admin" },
];
type Bal = { student_id: string; admission_no: string; name: string; class: string; total_charges: number; total_paid: number };
type Tx = { id: string; date: string; type: string; category: string; amount: number; source_module: string; source_id: string | null; reference: string | null; remarks: string | null; party: string | null; is_reversed: boolean; created_at: string };

function Kpi({ label, value, icon: I, tone, hint }: { label: string; value: number; icon: typeof Wallet; tone?: "good" | "bad" | "warn"; hint?: string }) {
  const c = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="min-w-0 max-w-full rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><I className="h-4 w-4" /></span>
      </div>
      <div className={`mt-2 break-words text-lg font-bold sm:text-2xl ${c}`}>{inr(value)}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
const Mini = ({ label, value }: { label: string; value: string | number }) => (
  <div className="min-w-0 max-w-full rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 break-words font-bold">{value}</div></div>
);
const Panel = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <div className="min-w-0 max-w-full rounded-xl border bg-card p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>
    {children}
  </div>
);

function Dashboard() {
  const { session, isFinance, isAdmin, sessions } = useApp();
  const [period, setPeriod] = useState<Period>("session");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [cls, setCls] = useState("");
  const range = periodRange(period, session, custom);
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["dash", sid, range.from, range.to],
    enabled: !!sid && isFinance,
    queryFn: async () => {
      const [tx, bal, stf, pp, recent] = await Promise.all([
        db.from("transactions").select("date, type, category, amount").eq("session_id", sid).eq("is_reversed", false).gte("date", range.from).lte("date", range.to).limit(50000),
        db.from("v_student_balances").select("student_id, admission_no, name, class, total_charges, total_paid").eq("session_id", sid).eq("status", "active").limit(20000),
        db.from("staff_sessions").select("staff_id, designation").eq("session_id", sid).eq("status", "active"),
        db.from("payroll_periods").select("salary_due").eq("session_id", sid).gte("month", range.from.slice(0, 7) + "-01").lte("month", range.to),
        db.from("transactions").select("id, date, type, category, amount, source_module, source_id, reference, remarks, party, is_reversed, created_at").eq("session_id", sid).gte("date", range.from).lte("date", range.to).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(8),
      ]);
      const err = tx.error ?? bal.error ?? stf.error ?? pp.error ?? recent.error;
      if (err) throw err;
      const rec = (recent.data ?? []) as Tx[];
      const ids = (m: string) => rec.filter((r) => r.source_module === m && r.source_id).map((r) => r.source_id!);
      const [fp, sp] = await Promise.all([
        ids("fee_payments").length ? db.from("fee_payments").select("id, students(name)").in("id", ids("fee_payments")) : Promise.resolve({ data: [] }),
        ids("staff_payments").length ? db.from("staff_payments").select("id, staff(name)").in("id", ids("staff_payments")) : Promise.resolve({ data: [] }),
      ]);
      const names = new Map<string, string>();
      for (const r of (fp.data ?? []) as unknown as { id: string; students: { name: string } | null }[]) names.set(r.id, r.students?.name ?? "");
      for (const r of (sp.data ?? []) as unknown as { id: string; staff: { name: string } | null }[]) names.set(r.id, r.staff?.name ?? "");
      return {
        tx: (tx.data ?? []) as { date: string; type: string; category: string; amount: unknown }[],
        bal: ((bal.data ?? []) as Bal[]).map((b) => ({ ...b, total_charges: num(b.total_charges), total_paid: num(b.total_paid) })),
        staff: (stf.data ?? []) as { staff_id: string; designation: string }[],
        salaryDue: sum(pp.data ?? [], (r: { salary_due: unknown }) => num(r.salary_due)),
        recent: rec.map((r) => ({ ...r, who: (r.source_id && names.get(r.source_id)) || r.party || "" })),
      };
    },
  });

  const d = useMemo(() => {
    if (!q.data) return null;
    const { tx, bal, staff, salaryDue } = q.data;
    const by = (type: string, cats?: string[]) => sum(tx.filter((r) => r.type === type && (!cats || cats.includes(r.category))), (r) => num(r.amount));
    const fb = cls ? bal.filter((b) => b.class === cls) : bal;
    const totalFees = sum(fb, (b) => b.total_charges);
    const paid = sum(fb, (b) => b.total_paid);
    const pending = totalFees - paid;
    const income = by("income"), expense = by("expense");
    const staffSal = by("expense", ["Staff Salary"]), driverSal = by("expense", ["Driver Salary"]);
    const salPaid = staffSal + driverSal;
    const salaryRecords = tx.filter((r) => r.type === "expense" && (r.category === "Staff Salary" || r.category === "Driver Salary")).length;
    const charged = fb.filter((b) => b.total_charges > 0);
    return {
      totalFees, paid, pending, income, expense, net: income - expense, staffSal, driverSal, salPaid, salaryDue, salaryRecords,
      staffCount: new Set(staff.map((s) => s.staff_id)).size,
      students: new Set(fb.map((b) => b.student_id)).size,
      withPending: charged.filter((b) => b.total_charges - b.total_paid > 0).length,
      fullyPaid: charged.filter((b) => b.total_charges - b.total_paid <= 0).length,
      partial: charged.filter((b) => b.total_paid > 0 && b.total_charges - b.total_paid > 0).length,
      top: [...fb].map((b) => ({ ...b, pend: b.total_charges - b.total_paid })).filter((b) => b.pend > 0).sort((a, b) => b.pend - a.pend).slice(0, 10),
      classes: [...new Set(bal.map((b) => b.class).filter(Boolean))].sort(),
    };
  }, [q.data, cls]);

  if (!isFinance) return <Navigate to="/my" />;
  const pct = d && d.totalFees > 0 ? Math.round((d.paid / d.totalFees) * 1000) / 10 : 0;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <PageHeader title="Dashboard"
        subtitle={session ? <span>Showing data for: <b className="text-primary">{session.name}</b>{period !== "session" && ` · ${fmtDate(range.from)} – ${fmtDate(range.to)}`}</span> : "No session selected"}
        actions={<>
          <PeriodFilter period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
          {d && d.classes.length > 0 && (
            <select aria-label="Class" className="h-10 max-w-full rounded-md border border-input bg-background px-2 text-base sm:text-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>{d.classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </>} />

      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {QUICK.filter((x) => isAdmin || x.who === "finance").map((x) => (
          <Button key={x.to} asChild variant="outline" className="h-auto min-h-11 min-w-0 justify-start gap-1.5 whitespace-normal text-left text-sm"><Link to={x.to}><Plus className="h-4 w-4 shrink-0 text-primary" />{x.l}</Link></Button>
        ))}
      </div>

      {!sessions.length ? (
        <Empty text="No academic session yet. Create your first session (e.g. 2025-26) to start.">
          {isAdmin && <Button asChild size="sm"><Link to="/settings">Create session</Link></Button>}
        </Empty>
      ) : q.isLoading || q.isFetching && !d ? <Loading text="Calculating dashboard…" /> : q.error ? <ErrorState error={q.error} /> : d && q.data && (
        <>
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-[340px]:grid-cols-1 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total Session Fees" value={d.totalFees} icon={IndianRupee} hint="Paid + Pending" />
            <Kpi label="Paid Fees" value={d.paid} icon={Wallet} tone="good" />
            <Kpi label="Pending Fees" value={d.pending} icon={Clock} tone={d.pending > 0 ? "warn" : undefined} />
            <Kpi label="Total Collection" value={d.income} icon={TrendingUp} hint="All income in period" />
            <Kpi label="Total Expenses" value={d.expense} icon={TrendingDown} tone="bad" />
            <Kpi label="Net Balance" value={d.net} icon={Scale} tone={d.net >= 0 ? "good" : "bad"} />
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <Panel title="Fee collection summary (whole session)">
                {d.totalFees <= 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No data available</p> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center max-[380px]:grid-cols-1">
                      <Mini label="Total Session Fees" value={inr(d.totalFees)} />
                      <Mini label="Paid" value={inr(d.paid)} />
                      <Mini label="Pending" value={inr(d.pending)} />
                    </div>
                    <div>
                      <div className="flex h-4 overflow-hidden rounded-full bg-warning/25">
                        <div className="h-full bg-success" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between text-sm"><span className="font-semibold text-success">Paid {pct}%</span><span className="font-semibold text-warning">Pending {Math.round((100 - pct) * 10) / 10}%</span></div>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
            <Panel title="Salary overview">
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-[340px]:grid-cols-1">
                <Mini label="Salary due" value={inr(d.salaryDue)} />
                <Mini label="Salary paid" value={inr(d.salPaid)} />
                <Mini label="Remaining" value={inr(Math.max(0, d.salaryDue - d.salPaid))} />
                <Mini label="Staff" value={d.staffCount} />
                <Mini label="Paid records" value={d.salaryRecords} />
                <Mini label="Staff / Driver" value={`${inr(d.staffSal)} / ${inr(d.driverSal)}`} />
              </div>
            </Panel>
          </div>

          <Panel title="Students & fees">
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-[340px]:grid-cols-1 sm:grid-cols-4 lg:grid-cols-7">
              <Mini label="Total students" value={d.students} />
              <Mini label="With pending fees" value={d.withPending} />
              <Mini label="Fully paid" value={d.fullyPaid} />
              <Mini label="Partial payment" value={d.partial} />
              <Mini label="Total fee charges" value={inr(d.totalFees)} />
              <Mini label="Fee collected" value={inr(d.paid)} />
              <Mini label="Outstanding" value={inr(d.pending)} />
            </div>
          </Panel>

          <DashCharts tx={q.data.tx} pending={Math.max(0, d.pending)} collected={d.paid} />

          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <Panel title="Recent transactions" action={<Button asChild size="sm" variant="outline"><Link to="/m/$module" params={{ module: "accounts" }}>View all</Link></Button>}>
              {!q.data.recent.length ? <p className="py-6 text-center text-sm text-muted-foreground">No data available</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5 pr-2">Date</th><th className="pr-2">Type</th><th className="pr-2">Description</th><th className="pr-2">Student/Staff</th><th className="pr-2 text-right">Amount</th><th>Status</th></tr></thead>
                  <tbody>{q.data.recent.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className={`pr-2 ${r.type === "income" ? "text-success" : "text-destructive"}`}>{r.type === "income" ? "Income" : "Expense"}</td>
                      <td className="pr-2">{r.category}{r.reference ? ` · ${r.reference}` : ""}</td>
                      <td className="pr-2">{r.who}</td>
                      <td className="pr-2 text-right font-medium whitespace-nowrap">{inr(r.amount)}</td>
                      <td className="text-xs">{r.is_reversed ? <span className="text-destructive">Reversed</span> : "Valid"}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </Panel>
            <Panel title="Top pending fees">
              {!d.top.length ? <p className="py-6 text-center text-sm text-muted-foreground">No pending fees</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5 pr-2">Student</th><th className="pr-2">Adm No.</th><th className="pr-2">Class</th><th className="pr-2 text-right">Total</th><th className="pr-2 text-right">Paid</th><th className="text-right">Pending</th></tr></thead>
                  <tbody>{d.top.map((b) => (
                    <tr key={b.student_id} className="border-t">
                      <td className="py-1.5 pr-2"><Link to="/students/$id" params={{ id: b.student_id }} className="text-primary hover:underline">{b.name}</Link></td>
                      <td className="pr-2">{b.admission_no}</td><td className="pr-2">{b.class}</td>
                      <td className="pr-2 text-right whitespace-nowrap">{inr(b.total_charges)}</td>
                      <td className="pr-2 text-right whitespace-nowrap">{inr(b.total_paid)}</td>
                      <td className="text-right font-semibold text-warning whitespace-nowrap">{inr(b.pend)}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </Panel>
          </div>
          <p className="text-xs text-muted-foreground"><Users className="mr-1 inline h-3 w-3" />Fee totals cover the whole selected session; income, expense and charts follow the period filter. <UserCheck className="mx-1 inline h-3 w-3" />Reversed payments are excluded.</p>
        </>
      )}
    </div>
  );
}

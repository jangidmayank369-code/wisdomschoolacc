import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, useApp } from "@/lib/app-context";
import { periodRange, type Period } from "@/lib/period";
import { sum } from "@/lib/finance";
import { PeriodFilter } from "@/components/erp/PeriodFilter";
import { Empty, ErrorState, Loading, PageHeader, Section, StatCard, StatGrid } from "@/components/erp/States";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — WPS Doomra ERP" }, { name: "description", content: "School overview: students, staff, income and expenses." }] }),
  component: Dashboard,
});

const QUICK = [
  { to: "/m/students", l: "Add Student" }, { to: "/m/fee_payments", l: "Collect Fee" }, { to: "/m/staff", l: "Add Staff" },
  { to: "/payroll", l: "Record Salary" }, { to: "/attendance", l: "Mark Attendance" }, { to: "/m/driver_km_logs", l: "Add KM" }, { to: "/m/expenses", l: "Add Expense" },
];

function Dashboard() {
  const { session, isFinance, isAdmin, sessions } = useApp();
  const [period, setPeriod] = useState<Period>("session");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = periodRange(period, session, custom);
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["dash", sid, range.from, range.to],
    enabled: !!sid && isFinance,
    queryFn: async () => {
      const [tx, stu, stf, bal] = await Promise.all([
        db.from("transactions").select("type, category, amount").eq("session_id", sid).eq("is_reversed", false).gte("date", range.from).lte("date", range.to).limit(50000),
        db.from("student_sessions").select("id", { count: "exact", head: true }).eq("session_id", sid).eq("status", "active"),
        db.from("staff_sessions").select("id", { count: "exact", head: true }).eq("session_id", sid).eq("status", "active"),
        db.from("v_student_balances").select("total_charges, total_paid").eq("session_id", sid).limit(20000),
      ]);
      const err = tx.error ?? stu.error ?? stf.error ?? bal.error;
      if (err) throw err;
      const t = tx.data ?? [];
      const by = (type: string, cats?: string[]) => sum(t.filter((r) => r.type === type && (!cats || cats.includes(r.category))), (r) => r.amount);
      const fees = by("income", ["Student Fees"]);
      const income = by("income");
      const salaries = by("expense", ["Staff Salary", "Driver Salary"]);
      const transport = by("expense", ["Fuel", "Transport"]);
      const maint = by("expense", ["Maintenance"]);
      const expense = by("expense");
      return {
        students: stu.count ?? 0, staff: stf.count ?? 0, fees, other: income - fees, income,
        pending: sum(bal.data ?? [], (r) => Number(r.total_charges) - Number(r.total_paid)),
        salaries, transport, maint, otherExp: expense - salaries - transport - maint, expense, net: income - expense,
      };
    },
  });

  if (!isFinance) return <Navigate to="/my" />;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle={session ? `Session ${session.name}` : "No session selected"} actions={<PeriodFilter period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />} />
      {!sessions.length ? (
        <Empty text="No academic session yet. Create your first session (e.g. 2025-26) to start.">
          {isAdmin && <Button asChild size="sm"><Link to="/settings">Create session</Link></Button>}
        </Empty>
      ) : q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data && (
        <>
          <Section title="Overview">
            <StatGrid>
              <StatCard label="Active students" value={q.data.students} />
              <StatCard label="Active staff" value={q.data.staff} />
              <StatCard label="Fees received" value={q.data.fees} money tone="good" />
              <StatCard label="Fees pending (session)" value={q.data.pending} money tone={q.data.pending > 0 ? "warn" : undefined} />
            </StatGrid>
          </Section>
          <Section title="Income">
            <StatGrid>
              <StatCard label="Student fees" value={q.data.fees} money />
              <StatCard label="Other income" value={q.data.other} money />
              <StatCard label="Total income" value={q.data.income} money tone="good" />
            </StatGrid>
          </Section>
          <Section title="Expenses">
            <StatGrid>
              <StatCard label="Salaries paid" value={q.data.salaries} money />
              <StatCard label="Transport / fuel" value={q.data.transport} money />
              <StatCard label="Maintenance" value={q.data.maint} money />
              <StatCard label="Other expenses" value={q.data.otherExp} money />
              <StatCard label="Total expense" value={q.data.expense} money tone="bad" />
              <StatCard label="Net balance" value={q.data.net} money tone={q.data.net >= 0 ? "good" : "bad"} />
            </StatGrid>
          </Section>
        </>
      )}
      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {QUICK.filter((x) => isAdmin || ["/m/students", "/m/fee_payments", "/m/expenses"].includes(x.to)).map((x) => (
            <Button key={x.to} asChild variant="outline" className="h-12"><Link to={x.to}>{x.l}</Link></Button>
          ))}
        </div>
      </Section>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { periodRange, type Period } from "@/lib/period";
import { sum } from "@/lib/finance";
import { downloadCsv } from "@/lib/csv";
import { inr } from "@/lib/format";
import { DataTable } from "@/components/erp/DataTable";
import { PeriodFilter } from "@/components/erp/PeriodFilter";
import { Empty, Loading, PageHeader, Section } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — WPS Doomra ERP" }] }),
  component: Reports,
});

const LINKS: [string, string][] = [
  ["Students", "/m/students"], ["Class lists", "/m/student_sessions"], ["Fee charges", "/m/student_charges"], ["Fee collection", "/m/fee_payments"],
  ["Staff", "/m/staff"], ["Employment & salary", "/m/staff_sessions"], ["Salary payments", "/m/staff_payments"], ["Payroll", "/payroll"],
  ["Attendance", "/m/staff_attendance"], ["Leave", "/m/leave_requests"], ["Drivers", "/drivers"], ["Vehicles", "/m/vehicles"],
  ["Monthly KM", "/m/monthly_vehicle_km"], ["Fuel", "/fuel"], ["Maintenance", "/m/maintenance_expenses"],
  ["Income", "/m/income"], ["Expenses", "/m/expenses"], ["Accounts", "/m/accounts"],
];

function Reports() {
  const { session } = useApp();
  const [period, setPeriod] = useState<Period>("session");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const r = periodRange(period, session, custom);
  const sid = session?.id;

  const pending = useQuery({
    queryKey: ["mod", "pending", sid], enabled: !!sid,
    queryFn: async () => ((await db.from("v_student_balances").select("*").eq("session_id", sid).limit(20000)).data ?? [])
      .map((x) => ({ ...x, id: x.student_session_id, balance: Number(x.total_charges) - Number(x.total_paid) })).filter((x) => x.balance > 0),
  });
  const cats = useQuery({
    queryKey: ["mod", "cats", sid, r.from, r.to], enabled: !!sid,
    queryFn: async () => {
      const t = (await db.from("transactions").select("type, category, amount").eq("session_id", sid).eq("is_reversed", false).gte("date", r.from).lte("date", r.to).limit(50000)).data ?? [];
      const map = new Map<string, { id: string; type: string; category: string; amount: number }>();
      for (const x of t) { const k = x.type + x.category; const c = map.get(k) ?? { id: k, type: x.type, category: x.category, amount: 0 }; c.amount += Number(x.amount); map.set(k, c); }
      return [...map.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle={`Session ${session?.name ?? "—"}`} />
      <Section title="Module reports (filters, CSV export & print on each page)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {LINKS.map(([l, to]) => <Button key={to} asChild variant="outline" className="h-11"><Link to={to}>{l}</Link></Button>)}
        </div>
      </Section>
      <Section title="Income & expense by category" actions={<>
        <PeriodFilter period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
        <Button size="sm" variant="outline" disabled={!cats.data?.length} onClick={() => downloadCsv(`category_summary_${r.from}_${r.to}.csv`, ["Type", "Category", "Amount"], cats.data!.map((c) => [c.type, c.category, c.amount]))}>Export</Button>
      </>}>
        {cats.isLoading ? <Loading /> : !cats.data?.length ? <Empty /> : (
          <>
            <DataTable rows={cats.data} columns={[{ key: "type", label: "Type" }, { key: "category", label: "Category" }, { key: "amount", label: "Amount", money: true }]} />
            <p className="text-sm">Income <b>{inr(sum(cats.data.filter((c) => c.type === "income"), (c) => c.amount))}</b> · Expense <b>{inr(sum(cats.data.filter((c) => c.type === "expense"), (c) => c.amount))}</b></p>
          </>
        )}
      </Section>
      <Section title="Pending fees" actions={<Button size="sm" variant="outline" disabled={!pending.data?.length}
        onClick={() => downloadCsv(`pending_fees_${session?.name}.csv`, ["Adm No", "Name", "Class", "Section", "Phone", "Charges", "Paid", "Balance"], pending.data!.map((p) => [p.admission_no, p.name, p.class, p.section, p.phone, p.total_charges, p.total_paid, p.balance]))}>Export</Button>}>
        {pending.isLoading ? <Loading /> : !pending.data?.length ? <Empty text="No pending fees" /> : (
          <DataTable rows={pending.data} columns={[
            { key: "admission_no", label: "Adm No" }, { key: "name", label: "Name" }, { key: "class", label: "Class" }, { key: "section", label: "Sec" },
            { key: "phone", label: "Phone" }, { key: "total_charges", label: "Charges", money: true }, { key: "total_paid", label: "Paid", money: true }, { key: "balance", label: "Balance", money: true },
          ]} />
        )}
      </Section>
    </div>
  );
}

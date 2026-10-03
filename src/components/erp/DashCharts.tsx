import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr, num } from "@/lib/format";
import { Section } from "./States";

type Tx = { date: string; type: string; category: string; amount: unknown };
const C = ["var(--primary)", "var(--destructive)", "var(--success)", "var(--warning)", "var(--muted-foreground)", "oklch(0.55 0.15 280)"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const money = (v: unknown) => inr(num(v));

function Card({ title, empty, emptyText = "No data available", children }: { title: string; empty: boolean; emptyText?: string; children: React.ReactElement }) {
  return (
    <div className="min-w-0 max-w-full rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {empty ? <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{emptyText}</div>
        : <div className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </div>
  );
}

/** Dashboard charts built only from real ledger rows for the selected session/period. */
export function DashCharts({ tx, pending, collected }: { tx: Tx[]; pending: number; collected: number }) {
  const months = new Map<string, { m: string; fees: number; income: number; expense: number }>();
  const cats = new Map<string, number>();
  let salary = 0, otherExp = 0;
  for (const r of tx) {
    const k = r.date.slice(0, 7);
    const row = months.get(k) ?? { m: k, fees: 0, income: 0, expense: 0 };
    const a = num(r.amount);
    if (r.type === "income") { row.income += a; if (r.category === "Student Fees") row.fees += a; }
    else {
      row.expense += a;
      cats.set(r.category, (cats.get(r.category) ?? 0) + a);
      if (r.category === "Staff Salary" || r.category === "Driver Salary") salary += a; else otherExp += a;
    }
    months.set(k, row);
  }
  const series = [...months.values()].sort((a, b) => a.m.localeCompare(b.m)).map((r) => ({ ...r, label: label(r.m) }));
  const catData = [...cats.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const axis = { fontSize: 11 };
  const yFmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

  return (
    <Section title="Charts">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <Card title="Fee collection by month (trend)" empty={!series.some((r) => r.fees)}>
          <LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={yFmt} width={40} />
            <Tooltip formatter={money} /><Line type="monotone" dataKey="fees" name="Fees" stroke={C[0]} strokeWidth={2} isAnimationActive={false} /></LineChart>
        </Card>
        <Card title="Income vs expense by month" empty={!series.length}>
          <BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={yFmt} width={40} />
            <Tooltip formatter={money} /><Legend /><Bar dataKey="income" name="Income" fill={C[2]} isAnimationActive={false} /><Bar dataKey="expense" name="Expenses" fill={C[1]} isAnimationActive={false} /></BarChart>
        </Card>
        <Card title="Fees collected vs pending" empty={!pending && !collected}>
          <PieChart><Tooltip formatter={money} /><Legend />
            <Pie data={[{ name: "Collected", value: collected }, { name: "Pending (session)", value: pending }]} dataKey="value" nameKey="name" outerRadius={75} isAnimationActive={false}>
              <Cell fill={C[2]} /><Cell fill={C[3]} /></Pie></PieChart>
        </Card>
        <Card title="Salary vs other expenses" empty={!salary && !otherExp} emptyText="No expense data available">
          <PieChart><Tooltip formatter={money} /><Legend />
            <Pie data={[{ name: "Salaries", value: salary }, { name: "Other expenses", value: otherExp }]} dataKey="value" nameKey="name" outerRadius={75} isAnimationActive={false}>
              <Cell fill={C[0]} /><Cell fill={C[4]} /></Pie></PieChart>
        </Card>
        <div className="min-w-0 md:col-span-2">
          <Card title="Expense category breakdown" empty={!catData.length} emptyText="No expense data available">
            <BarChart data={catData} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={axis} tickFormatter={yFmt} />
              <YAxis type="category" dataKey="name" tick={axis} width={95} /><Tooltip formatter={money} />
              <Bar dataKey="value" name="Amount" isAnimationActive={false}>{catData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Bar></BarChart>
          </Card>
        </div>
      </div>
    </Section>
  );
}

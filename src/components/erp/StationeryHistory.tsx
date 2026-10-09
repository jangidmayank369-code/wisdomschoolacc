import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { db, useApp } from "@/lib/app-context";
import { inr, fmtDate } from "@/lib/format";
import { Empty, ErrorState, Loading, StatCard, StatGrid } from "./States";

type Charge = { id: string; student_id: string; category_id: string; amount: number; created_at: string; remarks: string | null; stationery_items: { name: string; quantity: number; price: number }[] | null; students: { name: string; admission_no: string } | null };
export function StationeryHistory({ studentId, search = "" }: { studentId?: string; search?: string }) {
  const { session } = useApp();
  const q = useQuery({
    queryKey: ["stationery", session?.id, studentId], enabled: !!session,
    queryFn: async () => {
      const categories = await db.from("fee_categories").select("id").in("name", ["Stationery Charges", "Stationery"]);
      if (categories.error) throw categories.error;
      const ids = (categories.data ?? []).map((c) => c.id);
      if (!ids.length) return { rows: [], charged: 0, paid: 0 };
      let charges = db.from("student_charges").select("id, student_id, category_id, amount, created_at, remarks, stationery_items, students(name, admission_no)").eq("session_id", session?.id).in("category_id", ids).order("created_at").order("id").limit(20000);
      let payments = db.from("fee_payments").select("student_id, category_id, amount").eq("session_id", session?.id).eq("is_reversed", false).in("category_id", ids).limit(20000);
      if (studentId) { charges = charges.eq("student_id", studentId); payments = payments.eq("student_id", studentId); }
      const [c, p, en] = await Promise.all([charges, payments, db.from("student_sessions").select("student_id, class").eq("session_id", session?.id)]);
      if (c.error || p.error || en.error) throw c.error ?? p.error ?? en.error;
      const paid = new Map<string, number>();
      for (const r of p.data ?? []) { const key = `${r.student_id}:${r.category_id}`; paid.set(key, (paid.get(key) ?? 0) + Number(r.amount)); }
      const classes = new Map((en.data ?? []).map((r) => [r.student_id, r.class]));
      const rows = (c.data as unknown as Charge[] ?? []).map((r) => {
        const key = `${r.student_id}:${r.category_id}`, amount = Number(r.amount);
        const allocated = Math.min(amount, paid.get(key) ?? 0);
        paid.set(key, (paid.get(key) ?? 0) - allocated);
        return { ...r, amount, paid: allocated, balance: amount - allocated, class: classes.get(r.student_id) ?? "—" };
      });
      return { rows: rows.reverse(), charged: rows.reduce((n, r) => n + r.amount, 0), paid: (p.data ?? []).reduce((n, r) => n + Number(r.amount), 0) };
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const data = q.data;
  if (!data) return null;
  const term = search.toLowerCase().trim();
  const rows = data.rows.filter((r) => !term || `${r.students?.name} ${r.students?.admission_no}`.toLowerCase().includes(term));
  return <div className="space-y-3">
    {studentId && <StatGrid><StatCard label="Total stationery charged" value={data.charged} money /><StatCard label="Total stationery paid" value={data.paid} money tone="good" /><StatCard label="Stationery pending" value={data.charged - data.paid} money /></StatGrid>}
    {!rows.length ? <Empty text="No stationery issues in this session." /> : rows.map((r) => <article key={r.id} className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><Link to="/students/$id" params={{ id: r.student_id }} className="font-semibold text-primary">{r.students?.name}</Link><p className="text-xs text-muted-foreground">SR No. {r.students?.admission_no} · Class {r.class} · {fmtDate(r.created_at)}</p></div><strong>{inr(r.amount)}</strong></div>
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Items / issue breakdown</summary><div className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.remarks || "No item breakdown recorded"}</div></details>
      <div className="mt-3 flex flex-wrap gap-4 text-sm"><span>Total <b>{inr(r.amount)}</b></span><span>Paid <b className="text-success">{inr(r.paid)}</b></span><span>Balance <b className="text-warning">{inr(r.balance)}</b></span></div>
    </article>)}
    {!!data.rows.length && <p className="text-xs text-muted-foreground">Category-tagged stationery payments are allocated to oldest charges first. Uncategorised fee payments are not assigned to stationery.</p>}
  </div>;
}
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/erp/FormDialog";
import { getModule } from "@/lib/modules";
import { useQuery } from "@tanstack/react-query";
import { db, useApp } from "@/lib/app-context";
import { fmtDate } from "@/lib/format";
import { sum } from "@/lib/finance";
import type { Row } from "@/lib/modules";
import { DataTable } from "@/components/erp/DataTable";
import { ResourcePage } from "@/components/erp/ResourcePage";
import { Empty, ErrorState, Loading, PageHeader, Section, StatCard, StatGrid } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student Profile — WPS Doomra ERP" }] }),
  component: StudentProfile,
});

const enFields = getModule("student_sessions")!.fields.filter((f) => !f.createOnly);

function StudentProfile() {
  const { id } = Route.useParams();
  const { session, sessions, isAdmin } = useApp();
  const [editing, setEditing] = useState<Row | null>(null);
  const q = useQuery({
    queryKey: ["profile", "student", id, session?.id],
    queryFn: async () => {
      const [s, en, ch, pa] = await Promise.all([
        db.from("students").select("*").eq("id", id).single(),
        db.from("student_sessions").select("*, academic_sessions(name)").eq("student_id", id),
        db.from("student_charges").select("amount").eq("student_id", id).eq("session_id", session?.id ?? ""),
        db.from("fee_payments").select("amount").eq("student_id", id).eq("session_id", session?.id ?? "").eq("is_reversed", false),
      ]);
      if (s.error) throw s.error;
      const ids = [...new Set((en.data ?? []).map((r: Row) => r.created_by).filter(Boolean))];
      const pr = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names: Record<string, string> = Object.fromEntries((pr.data ?? []).map((p: Row) => [p.id, p.full_name]));
      return { names, s: s.data as Row, en: (en.data ?? []) as Row[], charges: sum(ch.data ?? [], (r) => r.amount), paid: sum(pa.data ?? [], (r) => r.amount) };
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const { s, en, charges, paid, names } = q.data!;
  const hist = [...sessions].reverse().map((ss) => en.find((e) => e.session_id === ss.id) ?? { session_id: ss.id, academic_sessions: { name: ss.name }, status: "" });
  const cur = en.find((e) => e.session_id === session?.id);
  const info: [string, unknown][] = [["Father", s.father_name], ["Mother", s.mother_name], ["Phone", s.phone], ["Gender", s.gender], ["DOB", fmtDate(s.dob)], ["Admission date", fmtDate(s.admission_date)], ["Address", s.address], ["Status", s.status]];

  return (
    <div className="space-y-6">
      <PageHeader title={s.name} subtitle={`Adm/SR No ${s.admission_no}${cur ? ` · Class ${cur.class}${cur.section ? "-" + cur.section : ""} · Roll ${cur.roll_no ?? "—"}` : ""}`} />
      <StatGrid>
        <StatCard label={`Total charges (${session?.name ?? ""})`} value={charges} money />
        <StatCard label="Total paid" value={paid} money tone="good" />
        <StatCard label="Balance" value={charges - paid} money tone={charges - paid > 0 ? "warn" : undefined} />
      </StatGrid>
      <Section title="Basic & parent information">
        <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 text-sm sm:grid-cols-4">
          {info.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{String(v || "—")}</dd></div>)}
        </dl>
      </Section>
      <Section title="Enrollment History">
        <DataTable rows={hist} columns={[
          { key: "s", label: "Session", value: (r) => r.academic_sessions?.name }, { key: "class", label: "Class", value: (r) => r.id ? r.class : "Not Enrolled" }, { key: "section", label: "Section" },
          { key: "enrollment_date", label: "Enrolled", render: (r) => fmtDate(r.enrollment_date) }, { key: "status", label: "Status" },
          { key: "created_by", label: "Created By", value: (r) => names[r.created_by] ?? "" },
          { key: "created_at", label: "Created At", value: (r) => r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "" },
        ]} actions={isAdmin ? (r) => r.id ? <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button> : null : undefined} />
        <FormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit enrollment — ${editing?.academic_sessions?.name ?? ""}`}
          fields={enFields} record={editing} refs={{}} onSubmit={async (v) => {
            const { error } = await db.from("student_sessions").update(v).eq("id", editing!.id);
            if (error) throw error;
            await q.refetch();
          }} />
      </Section>
      {cur ? (
        <>
          <ResourcePage embedded moduleKey="student_charges" where={{ student_id: id }} title="Charges" />
          <ResourcePage embedded moduleKey="fee_payments" where={{ student_id: id }} title="Payments" />
        </>
      ) : <Empty text={`Not enrolled in ${session?.name ?? "selected session"}. Enroll via Class Lists to add charges/payments.`} />}
    </div>
  );
}

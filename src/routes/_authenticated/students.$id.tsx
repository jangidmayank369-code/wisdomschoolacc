import { createFileRoute } from "@tanstack/react-router";
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

function StudentProfile() {
  const { id } = Route.useParams();
  const { session } = useApp();
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
      return { s: s.data as Row, en: (en.data ?? []) as Row[], charges: sum(ch.data ?? [], (r) => r.amount), paid: sum(pa.data ?? [], (r) => r.amount) };
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const { s, en, charges, paid } = q.data!;
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
        {en.length ? <DataTable rows={en} columns={[
          { key: "s", label: "Session", value: (r) => r.academic_sessions?.name }, { key: "class", label: "Class" }, { key: "section", label: "Section" },
          { key: "roll_no", label: "Roll" }, { key: "status", label: "Status" }, { key: "transport_route", label: "Transport" },
        ]} /> : <Empty text="No enrollment" />}
        {!cur && <p className="text-sm text-muted-foreground">{session?.name}: No enrollment</p>}
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

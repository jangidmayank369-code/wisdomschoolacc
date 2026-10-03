import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { errMsg, today } from "@/lib/format";
import { ResourcePage } from "@/components/erp/ResourcePage";
import { Empty, ErrorState, Loading, PageHeader, Section } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — WPS Doomra ERP" }] }),
  component: Attendance,
});

const OPTS = [["present", "P"], ["absent", "A"], ["half_day", "H"], ["leave", "L"]] as const;

function Attendance() {
  const { session } = useApp();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sid = session?.id;

  const q = useQuery({
    queryKey: ["mod", "att-mark", sid, date],
    enabled: !!sid,
    queryFn: async () => {
      const [ss, att, lv] = await Promise.all([
        db.from("staff_sessions").select("staff_id, designation, staff(employee_id, name)").eq("session_id", sid).eq("status", "active"),
        db.from("staff_attendance").select("staff_id, status").eq("date", date).eq("session_id", sid),
        db.from("leave_requests").select("staff_id").eq("status", "approved").lte("from_date", date).gte("to_date", date),
      ]);
      if (ss.error) throw ss.error;
      return { staff: ss.data ?? [], att: att.data ?? [], leave: new Set((lv.data ?? []).map((l) => l.staff_id)) };
    },
  });

  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, string> = {};
    for (const s of q.data.staff) m[s.staff_id] = q.data.att.find((a) => a.staff_id === s.staff_id)?.status ?? (q.data.leave.has(s.staff_id) ? "leave" : "present");
    setMarks(m);
  }, [q.data]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const locked = new Set((q.data?.att ?? []).map((a) => a.staff_id));
    const rows = Object.entries(marks).filter(([id]) => !locked.has(id)).map(([staff_id, status]) => ({ staff_id, status, date, session_id: sid }));
    if (!rows.length) { setBusy(false); toast.info("All attendance for this date is already saved and locked."); return; }
    if (!confirm(`Save attendance for ${rows.length} staff? It cannot be edited after saving.`)) { setBusy(false); return; }
    const { error } = await db.from("staff_attendance").insert(rows);
    setBusy(false);
    if (error) toast.error(errMsg(error)); else { toast.success(`Attendance saved for ${rows.length} staff`); qc.invalidateQueries({ queryKey: ["mod"] }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mark Attendance" subtitle={session?.name} actions={<Input type="date" className="h-10 w-[160px]" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : !q.data?.staff.length ? <Empty text="No active staff in this session." /> : (
        <div className="space-y-2">
          {q.data.staff.map((s) => (
            <div key={s.staff_id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{(s.staff as any)?.name}</div>
                <div className="text-xs text-muted-foreground">{(s.staff as any)?.employee_id} · {s.designation}{q.data.leave.has(s.staff_id) ? " · approved leave" : ""}{q.data.att.some((a) => a.staff_id === s.staff_id) ? " · saved 🔒" : ""}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {OPTS.map(([v, l]) => (
                  <button key={v} disabled={q.data.att.some((a) => a.staff_id === s.staff_id)} onClick={() => setMarks({ ...marks, [s.staff_id]: v })} aria-label={v}
                    className={`h-9 w-9 rounded-md border text-sm font-bold ${marks[s.staff_id] === v ? (v === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground") : "bg-background"}`}>{l}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="sticky bottom-16 lg:bottom-2"><Button className="h-11 w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save attendance"}</Button></div>
        </div>
      )}
      <Section title="Attendance records"><ResourcePage embedded moduleKey="staff_attendance" /></Section>
    </div>
  );
}

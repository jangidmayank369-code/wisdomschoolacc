import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, useApp } from "@/lib/app-context";
import { errMsg, inr, today } from "@/lib/format";
import type { Row } from "@/lib/modules";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
export const OPTIONAL_ROLES = ["Driver", "Accountant", "Teacher", "Peon", "Other"];
type Kind = "student" | "staff";

/**
 * Reuse existing people in another session: creates ONLY a new enrollment
 * (student_sessions) or employment (staff_sessions) row. Never copies fees,
 * payments, payroll, attendance or Accounts. DB unique (person, session) blocks duplicates.
 */
export function SessionImportDialog({ kind }: { kind: Kind }) {
  const { sessions, session } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, Row>>({});
  const [common, setCommon] = useState({ date: today(), status: "active" });
  const [step, setStep] = useState<"pick" | "preview">("pick");
  const [busy, setBusy] = useState(false);
  const table = kind === "student" ? "student_sessions" : "staff_sessions";
  const pid = kind === "student" ? "student_id" : "staff_id";
  const name = (id: string) => sessions.find((s) => s.id === id)?.name ?? "—";

  const q = useQuery({
    enabled: open && !!src && !!tgt && src !== tgt,
    queryKey: ["sessimport", kind, src, tgt],
    queryFn: async () => {
      const person = kind === "student" ? "students(admission_no, name)" : "staff(employee_id, name)";
      const [a, b] = await Promise.all([
        db.from(table).select(`*, ${person}`).eq("session_id", src).limit(5000),
        db.from(table).select("*").eq("session_id", tgt).limit(5000),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      const existing = new Map((b.data ?? []).map((r: Row) => [r[pid], r]));
      return { rows: (a.data ?? []) as Row[], existing };
    },
  });
  const desig = useQuery({ enabled: open && kind === "staff", queryKey: ["master", "designation"], queryFn: async () => (await db.from("master_items").select("name").eq("kind", "designation").eq("is_active", true).order("name")).data ?? [] });

  const who = (r: Row) => kind === "student" ? r.students : r.staff;
  const code = (r: Row) => kind === "student" ? who(r)?.admission_no : who(r)?.employee_id;
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.rows ?? []).filter((r) => !s || `${who(r)?.name} ${code(r)}`.toLowerCase().includes(s))
      .sort((a, b) => String(code(a)).localeCompare(String(code(b)), undefined, { numeric: true }));
  }, [q.data, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (r: Row) => setPicked((p) => {
    const n = { ...p };
    if (n[r[pid]]) delete n[r[pid]];
    else n[r[pid]] = kind === "student"
      ? { src: r, class: r.class ?? "", section: r.section ?? "" }
      : { src: r, designation: r.designation ?? "", optional_role: r.optional_role ?? "", monthly_salary: String(r.monthly_salary ?? ""), joining_date: "", exit_date: "" };
    return n;
  });
  const edit = (id: string, k: string, v: string) => setPicked((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const items = Object.entries(picked);
  const invalid = items.some(([, v]) => kind === "student" ? !v.class.trim() : !v.designation || !(Number(v.monthly_salary) >= 0) || v.monthly_salary === "" || (common.status === "left" && !v.exit_date));

  const reset = () => { setPicked({}); setStep("pick"); setSearch(""); };
  const confirm = async () => {
    setBusy(true);
    let ok = 0; const errs: string[] = [];
    for (const [id, v] of items) {
      const row: Row = kind === "student"
        ? { student_id: id, session_id: tgt, class: v.class.trim(), section: v.section.trim() || null, status: common.status, enrollment_date: common.date || null, remarks: `Imported from ${name(src)}` }
        : { staff_id: id, session_id: tgt, designation: v.designation, optional_role: v.optional_role || null, category: v.src.category ?? null, monthly_salary: Number(v.monthly_salary), joining_date: v.joining_date || common.date || null, exit_date: common.status === "active" ? null : v.exit_date || null, status: common.status, remarks: `Imported from ${name(src)}` };
      // Reuse (reactivate) an inactive target-session record instead of inserting a duplicate.
      const ex = q.data?.existing.get(id);
      if (ex?.status === "active") { errs.push(`${who(v.src)?.name}: Already active in ${name(tgt)}`); continue; }
      if (ex) { delete row[pid]; delete row.session_id; row.remarks = `${ex.remarks ? ex.remarks + " | " : ""}Reactivated via import from ${name(src)}`; }
      const { error } = ex ? await db.from(table).update(row).eq("id", ex.id).eq("session_id", tgt) : await db.from(table).insert(row);
      if (error) errs.push(`${who(v.src)?.name}: ${error.code === "23505" ? `Already exists in ${name(tgt)}` : errMsg(error)}`);
      else ok++;
    }
    setBusy(false);
    if (ok) toast.success(`${ok} imported into ${name(tgt)}`);
    errs.forEach((e) => toast.error(e));
    await qc.invalidateQueries();
    reset(); setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setTgt(session?.id ?? ""); setOpen(true); }}><ArrowDownToLine className="h-4 w-4" />Import from Other Session</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) reset(); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import {kind === "student" ? "students" : "staff"} from other session</DialogTitle>
            <DialogDescription>Creates only a new {kind === "student" ? "enrollment" : "employment"} in the target session. No fees, payments, salary, payroll, attendance or Accounts are copied.</DialogDescription>
          </DialogHeader>

          {step === "pick" && (
            <div className="space-y-3">
               <div className="grid gap-2 sm:grid-cols-4">
                <label className="text-xs">1. Source session<select className={sel} value={src} onChange={(e) => { setSrc(e.target.value); setPicked({}); }}><option value="">— Select —</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="text-xs">2. Target session<select className={sel} value={tgt} onChange={(e) => { setTgt(e.target.value); setPicked({}); }}><option value="">— Select —</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="text-xs">{kind === "student" ? "Enrollment date" : "Default joining date"}<Input type="date" className="h-9" value={common.date} onChange={(e) => setCommon({ ...common, date: e.target.value })} /></label>
                 <label className="text-xs">Status<select className={sel} value={common.status} onChange={(e) => setCommon({ ...common, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option><option value="left">left</option></select></label>
              </div>
              {src && tgt && src === tgt && <p className="text-sm text-destructive">Source and target must be different sessions.</p>}
              {src && tgt && src !== tgt && (
                <>
                  <Input placeholder={`3. Search ${kind === "student" ? "name / admission no" : "name / employee ID"}`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
                  <div className="max-h-[45vh] overflow-y-auto rounded-md border text-sm">
                    {q.isLoading ? <p className="p-3">Loading…</p> : !list.length ? <p className="p-3 text-muted-foreground">No data available</p> : list.map((r) => {
                      const ex = q.data!.existing.get(r[pid]);
                      const p = picked[r[pid]];
                      return (
                        <div key={r.id} className="border-b p-2">
                          <label className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" disabled={ex?.status === "active"} checked={!!p} onChange={() => toggle(r)} />
                            <span className="flex-1">
                              <b>{who(r)?.name}</b> · {code(r)} · {name(src)}: {kind === "student" ? `Class ${r.class}${r.section ? "-" + r.section : ""}` : `${r.designation}${r.optional_role ? " | " + r.optional_role : ""} | ${inr(r.monthly_salary)} | Joined ${r.joining_date ?? "—"}`}
                              {ex?.status === "active"
                                ? <span className="block text-xs text-destructive">Already active in target session ({name(tgt)}) — {kind === "student" ? `Class ${ex.class}` : `${ex.designation} ${inr(ex.monthly_salary)}`}</span>
                                : ex ? <span className="block text-xs text-warning-foreground">Inactive record exists in {name(tgt)} ({kind === "student" ? `Class ${ex.class}` : `${ex.designation} ${inr(ex.monthly_salary)}`}, {ex.status}) — can be reused</span>
                                : <span className="block text-xs text-muted-foreground">Ready to import</span>}
                            </span>
                          </label>
                          {p && (
                            <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-4">
                              {kind === "student" ? (<>
                                <Input className="h-9" placeholder="Target class *" value={p.class} onChange={(e) => edit(r[pid], "class", e.target.value)} />
                                <Input className="h-9" placeholder="Target section" value={p.section} onChange={(e) => edit(r[pid], "section", e.target.value)} />
                              </>) : (<>
                                <select className={sel} value={p.designation} onChange={(e) => edit(r[pid], "designation", e.target.value)}>
                                  <option value="">Designation *</option>
                                  {[...new Set([p.designation, ...(desig.data ?? []).map((d: Row) => d.name)].filter(Boolean))].map((d) => <option key={d}>{d}</option>)}
                                </select>
                                <select className={sel} value={p.optional_role} onChange={(e) => edit(r[pid], "optional_role", e.target.value)}>
                                  <option value="">Optional role: none</option>{OPTIONAL_ROLES.map((o) => <option key={o}>{o}</option>)}
                                </select>
                                <Input className="h-9" type="number" min="0" placeholder="Salary ₹ *" value={p.monthly_salary} onChange={(e) => edit(r[pid], "monthly_salary", e.target.value)} />
                                <Input className="h-9" type="date" title="Joining date (blank = default)" value={p.joining_date} onChange={(e) => edit(r[pid], "joining_date", e.target.value)} />
                                 {common.status === "left" && <Input className="h-9" type="date" title="Exit date" value={p.exit_date} onChange={(e) => edit(r[pid], "exit_date", e.target.value)} />}
                              </>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <span className="mr-auto self-center text-xs text-muted-foreground">{items.length} selected</span>
                <Button disabled={!items.length || invalid} onClick={() => setStep("preview")}>Preview</Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">SOURCE</div><b>{name(src)}</b></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">TARGET</div><b>{name(tgt)}</b></div>
              </div>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto text-sm">
                {items.map(([id, v]) => (
                  <div key={id} className="rounded-md border p-2">
                    <b>{who(v.src)?.name}</b> ({code(v.src)})
                    <div className="text-muted-foreground">{name(src)}: {kind === "student" ? `Class ${v.src.class}` : `${v.src.designation}${v.src.optional_role ? " | " + v.src.optional_role : ""} | ${inr(v.src.monthly_salary)}`}</div>
                    <div>↓ {name(tgt)}{q.data?.existing.get(id) ? " (reactivates existing inactive record)" : " (new record)"}: {kind === "student" ? `Class ${v.class}${v.section ? "-" + v.section : ""} · Enrolled ${common.date || "—"}` : `${v.designation}${v.optional_role ? " | " + v.optional_role : ""} | ${inr(Number(v.monthly_salary))} | Joining ${v.joining_date || common.date || "—"}`} · {common.status}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Will create {items.length} new {kind === "student" ? "enrollment" : "employment"} record(s) only. Starts with ₹0 fees/salary history in {name(tgt)}.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setStep("pick")}>Back</Button>
                <Button disabled={busy} onClick={confirm}>{busy ? "Importing…" : "Confirm Import"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

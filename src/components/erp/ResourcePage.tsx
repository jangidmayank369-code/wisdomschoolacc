import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Upload, Download, FileDown, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, useApp } from "@/lib/app-context";
import { getModule, type Field, type Row } from "@/lib/modules";
import { loadRefs, type RefKind } from "@/lib/refs";
import { exportRows, downloadSample } from "@/lib/import-export";
import { errMsg, inr, today } from "@/lib/format";
import { sum } from "@/lib/finance";
import { DataTable } from "./DataTable";
import { FormDialog } from "./FormDialog";
import { ImportDialog } from "./ImportDialog";
import { SessionImportDialog } from "./SessionImportDialog";
import { Empty, ErrorState, Loading, PageHeader } from "./States";

const selectCls = "h-10 rounded-md border border-input bg-background px-2 text-sm";
type Correction = { row: Row; kind: "reverse" | "date" | "status" | "km" | "amount" } | null;

/**
 * Generic, config-driven module page: list + search + filters + date range +
 * add/edit + import/sample/export/print + financial reversal/correction.
 * `where` restricts rows (e.g. one student) and pre-fills new records.
 */
export function ResourcePage({ moduleKey, where, embedded, title, allSessions }: { moduleKey: string; where?: Row; embedded?: boolean; title?: string; allSessions?: boolean }) {
  const m = getModule(moduleKey)!;
  const { session, sessions, isAdmin, roles, staffId, user } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Row>(allSessions || embedded ? {} : m.defaultFilters ?? {});
  const [empSid, setEmpSid] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [corr, setCorr] = useState<Correction>(null);

  const canWrite = m.writeRoles.some((r) => roles.includes(r));
  const sid = session?.id ?? null;
  const empSession = empSid ?? sid ?? "";
  const qk = ["mod", m.key, sid, where, filters, from, to];

  const list = useQuery({
    queryKey: qk,
    enabled: !(m.sessionScoped || m.sessionJoin) || allSessions || !!sid,
    queryFn: async () => {
      if (m.table === "driver_km_logs" && isAdmin) await db.rpc("generate_km_logs", {});
      const join = m.sessionJoin && !allSessions && !where ? m.sessionJoin : null;
      if (join && !sid) return [];
      let query = db.from(m.table).select(join ? `${m.select}, ${join.table}!inner(${join.select})` : m.select);
      if (join) query = query.eq(`${join.table}.session_id`, sid);
      if (m.sessionScoped && !allSessions) query = query.eq("session_id", sid);
      for (const [k, v] of Object.entries({ ...m.fixed, ...where, ...filters })) if (v) query = query.eq(k, v);
      if (m.dateField && from) query = query.gte(m.dateField, from);
      if (m.dateField && to) query = query.lte(m.dateField, to);
      const { data, error } = await query.order(m.orderBy, { ascending: !m.dateField && m.orderBy !== "created_at" }).limit(5000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const refKinds = useMemo(() => m.fields.filter((f) => f.type === "ref").map((f) => f.ref as RefKind), [m]);
  const refs = useQuery({
    queryKey: ["refs", refKinds, sid],
    enabled: editing !== undefined && refKinds.length > 0,
    queryFn: () => loadRefs(refKinds, sid),
  });

  const rows = useMemo(() => {
    let all = list.data ?? [];
    if (m.employmentFilter && empSession) all = all.filter((r) => ((r.staff_sessions ?? []) as Row[]).some((x) => x.session_id === empSession && x.status === "active"));
    if (!q.trim()) return all;
    const s = q.toLowerCase();
    return all.filter((r) => m.columns.some((c) => String(c.value ? c.value(r) : r[c.key] ?? "").toLowerCase().includes(s)));
  }, [list.data, q, m.columns, m.employmentFilter, empSession]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mod"] });
    qc.invalidateQueries({ queryKey: ["dash"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const formFields: Field[] = useMemo(() => m.fields.filter((f) => {
    if (where && f.name in where) return false;
    if (f.adminOnly && !isAdmin) return false;
    if (f.createOnly && editing) return false;
    return true;
  }), [m.fields, where, isAdmin, editing]);

  const save = async (vals: Row) => {
    const virtual: Row = {};
    const data: Row = {};
    for (const f of formFields) (f.virtual ? virtual : data)[f.name] = vals[f.name];
    if (editing) {
      const { error } = await db.from(m.table).update(data).eq("id", editing.id);
      if (error) throw error;
      toast.success("Updated");
    } else {
      if (m.confirmSave && !confirm(`Save this ${m.title.toLowerCase()} entry${data.amount != null ? ` of ₹${data.amount}` : ""}?`)) throw new Error("Cancelled — nothing saved");
      if (data.amount != null && !(Number(data.amount) > 0)) throw new Error("Amount must be greater than zero");
      const ins: Row = { ...m.fixed, ...m.insertDefaults, ...where, ...data };
      if (m.sessionScoped) { if (!sid) throw new Error("Select an academic session first"); ins.session_id = sid; }
      if (m.key === "leave_requests" && !isAdmin) ins.staff_id = staffId;
      if (m.tokenized) ins.client_token = crypto.randomUUID();
      const { data: rec, error } = await db.from(m.table).insert(ins).select("id").single();
      if (error) throw error;
      if (m.afterSave) await m.afterSave({ sessionId: sid, record: rec as Row, values: virtual });
      toast.success("Saved");
      if (m.key === "fee_payments") navigate({ to: "/receipt/$id", params: { id: (rec as Row).id } });
    }
    refresh();
  };

  const remove = async (r: Row) => {
    if (!confirm("Delete this record permanently?")) return;
    const { error } = await db.from(m.table).delete().eq("id", r.id);
    if (error) toast.error(errMsg(error)); else { toast.success("Deleted"); refresh(); }
  };

  const setLeave = async (r: Row, status: string) => {
    const { error } = await db.from("leave_requests").update({ status }).eq("id", r.id);
    if (error) toast.error(errMsg(error)); else { toast.success(`Leave ${status}`); refresh(); }
  };

  const dateCol = m.fields.find((f) => f.type === "date" && f.required)?.name ?? "date";
  const corrFields: Field[] = corr?.kind === "km"
    ? [{ name: "km", label: `KM for ${corr.row.date} (current ${corr.row.km})`, type: "number", required: true }, { name: "reason", label: "Reason for correction", type: "text", required: true }]
    : corr?.kind === "amount"
    ? [{ name: "amount", label: `Correct amount (current ₹${corr.row.amount})`, type: "number", required: true }, { name: "reason", label: "Reason for correction", type: "text", required: true }]
    : corr?.kind === "status"
    ? [{ name: "new_status", label: `New status (current: ${corr.row.status})`, type: "select", options: ["present", "absent", "half_day", "leave"], required: true }, { name: "reason", label: "Reason for correction", type: "text", required: true }]
    : corr?.kind === "date"
    ? [{ name: "new_date", label: "New date", type: "date", required: true }, { name: "reason", label: "Reason for change", type: "text", required: true }]
    : [{ name: "reason", label: "Reason for reversal", type: "text", required: true }];
  const applyCorrection = async (v: Row) => {
    if (!corr) return;
    if (corr.kind === "amount" && !(Number(v.amount) > 0)) throw new Error("Amount must be greater than zero");
    if (!confirm("Save this correction? It will be recorded in the audit log.")) throw new Error("Cancelled — nothing saved");
    const stamp = `by ${user?.email} at ${new Date().toLocaleString("en-IN")}`;
    const patch = corr.kind === "km"
      ? { km: v.km, is_override: true, change_reason: `KM ${corr.row.km} → ${v.km} ${stamp}: ${v.reason}`, updated_by: user?.id, updated_at: new Date().toISOString() }
      : corr.kind === "amount"
      ? { amount: v.amount, change_reason: `Amount ₹${corr.row.amount} → ₹${v.amount} ${stamp}: ${v.reason}`, corrected_by: user?.id, corrected_at: new Date().toISOString() }
      : corr.kind === "status"
      ? { status: v.new_status, change_reason: `Status ${corr.row.status} → ${v.new_status} by ${user?.email} at ${new Date().toLocaleString("en-IN")}: ${v.reason}` }
      : corr.kind === "date"
      ? { [dateCol]: v.new_date, change_reason: `Date ${corr.row[dateCol]} → ${v.new_date} by ${user?.email}: ${v.reason}` }
      : { is_reversed: true, reversal_reason: `${v.reason} (by ${user?.email})` };
    const { error } = await db.from(m.table).update(patch).eq("id", corr.row.id);
    if (error) throw error;
    toast.success(corr.kind === "reverse" ? "Reversed (audit logged)" : "Corrected (audit logged)");
    refresh();
  };

  const actions = (r: Row) => {
    const out = [];
    if (m.extraActions) out.push(<span key="x">{m.extraActions(r)}</span>);
    const editableTxn = m.table !== "transactions" || r.source_module === "manual";
    if (m.financial) {
      if (isAdmin && !r.is_reversed && editableTxn) {
        if (m.key === "staff_payments") out.push(<button key="a" className="text-sm text-primary underline" onClick={() => setCorr({ row: r, kind: "amount" })}>Correct amount</button>);
        out.push(<button key="d" className="text-sm text-primary underline" onClick={() => setCorr({ row: r, kind: "date" })}>Change date</button>);
        out.push(<button key="r" className="text-sm text-destructive underline" onClick={() => setCorr({ row: r, kind: "reverse" })}>Reverse</button>);
      }
      if (r.is_reversed) out.push(<span key="rv" className="text-xs font-semibold text-destructive">REVERSED</span>);
    } else if (m.key === "leave_requests") {
      if (isAdmin && r.status === "pending") {
        out.push(<button key="a" className="text-sm text-success underline" onClick={() => setLeave(r, "approved")}>Approve</button>);
        out.push(<button key="j" className="text-sm text-destructive underline" onClick={() => setLeave(r, "rejected")}>Reject</button>);
      }
      if (isAdmin) out.push(<button key="del" className="text-sm text-destructive underline" onClick={() => remove(r)}>Delete</button>);
    } else if (m.key === "driver_km_logs") {
      if (isAdmin) out.push(<button key="k" className="text-sm text-primary underline" onClick={() => setCorr({ row: r, kind: "km" })}>Edit day</button>);
    } else if (m.noEdit) {
      if (isAdmin) out.push(<button key="c" className="text-sm text-primary underline" onClick={() => setCorr({ row: r, kind: "status" })}>Correct</button>);
    } else if (canWrite && isAdmin) {
      out.push(<button key="e" className="text-sm text-primary underline" onClick={() => setEditing(r)}>Edit</button>);
      if (isAdmin) out.push(<button key="del" className="text-sm text-destructive underline" onClick={() => remove(r)}>Delete</button>);
    }
    return out.length ? out : null;
  };

  const amountCol = m.columns.find((c) => c.key === "amount");
  const total = amountCol ? sum(rows.filter((r) => !r.is_reversed), (r) => r.amount) : null;
  const canImport = canWrite && !!m.importCols && !where && (m.key !== "leave_requests" || isAdmin);

  const toolbar = (
    <>
      {canWrite && !m.noAdd && <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />{m.addLabel ?? "Add"}</Button>}
      {isAdmin && m.sessionImport && !where && <SessionImportDialog kind={m.sessionImport} />}
      {canImport && <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</Button>}
      {canImport && <Button size="sm" variant="outline" onClick={() => downloadSample(m)}><FileDown className="h-4 w-4" />Sample</Button>}
      <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => exportRows(m, rows, session?.name)}><Download className="h-4 w-4" />Export</Button>
      {!embedded && <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>}
    </>
  );

  return (
    <div className="space-y-3">
      {embedded
        ? <div className="no-print flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{title ?? m.title}</h3><div className="flex flex-wrap gap-2">{toolbar}</div></div>
        : <PageHeader title={m.title} subtitle={m.sessionScoped || m.sessionJoin ? `Showing data for: ${session?.name ?? "— none selected"}` : "All sessions (master records)"} actions={toolbar} />}

      {!embedded && (
        <div className="no-print flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="h-10 pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {m.employmentFilter && (
            <select aria-label="Session" className={selectCls} value={empSession} onChange={(e) => setEmpSid(e.target.value)}>
              <option value="">All Sessions</option>
              {sessions.map((x) => <option key={x.id} value={x.id}>Employed in {x.name}</option>)}
            </select>
          )}
          {m.filters?.map((f) => (
            <select key={f.name} className={selectCls} value={filters[f.name] ?? ""} onChange={(e) => setFilters({ ...filters, [f.name]: e.target.value })}>
              <option value="">{f.label}: All</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {m.dateField && (
            <div className="flex items-center gap-1">
              <Input type="date" className="h-10 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" className="h-10 w-[150px]" value={to} max={today()} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </div>
          )}
        </div>
      )}

      {m.sessionScoped && !sid ? <Empty text="No academic session yet. An admin must create one in Settings." />
        : list.isLoading ? <Loading />
        : list.error ? <ErrorState error={list.error} />
        : !rows.length ? (
          <Empty>
            {canWrite && !m.noAdd && <Button size="sm" onClick={() => setEditing(null)}>{m.addLabel ?? "Add"}</Button>}
            {canImport && <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>Import</Button>}
            {canImport && <Button size="sm" variant="outline" onClick={() => downloadSample(m)}>Sample</Button>}
          </Empty>
        ) : (
          <>
            {total != null && <div className="text-sm text-muted-foreground">{rows.length} records · Total <b className="text-foreground">{inr(total)}</b> (excluding reversed)</div>}
            <DataTable columns={m.columns} rows={rows} actions={actions}
              rowClass={(r) => (r.is_reversed ? "opacity-50 line-through" : "")}
              onRowClick={m.rowLink && !embedded ? (r) => { const to = m.rowLink!(r); if (to) navigate({ to }); } : undefined} />
          </>
        )}

      <FormDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}
        title={`${editing ? "Edit" : "Add"} ${m.title}`} fields={formFields} record={editing} refs={refs.data ?? {}} onSubmit={save} />
      <FormDialog open={!!corr} onOpenChange={(o) => !o && setCorr(null)} title={corr?.kind === "km" ? "Correct daily KM (audit logged)" : corr?.kind === "amount" ? "Correct payment amount (audit logged)" : corr?.kind === "status" ? "Correct attendance (admin, audit logged)" : corr?.kind === "date" ? "Correct payment date" : "Reverse entry"}
        fields={corrFields} refs={{}} onSubmit={applyCorrection} submitLabel="Confirm" />
      {m.importCols && <ImportDialog module={m} open={importOpen} onOpenChange={setImportOpen} onDone={refresh} />}
    </div>
  );
}

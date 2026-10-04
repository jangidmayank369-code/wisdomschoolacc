import { db, type AcademicSession } from "./app-context";
import { downloadCsv, hashUuid } from "./csv";
import { parseDate } from "./format";
import { findRef, loadRefs, type RefKind, type RefMaps } from "./refs";
import type { ModuleDef, Row } from "./modules";
import { cellValue } from "@/components/erp/DataTable";

const REF_KINDS: RefKind[] = ["student", "staff", "driver", "vehicle", "fee_category"];

/** Sample CSV: exact headers, 1 example row, and a notes row. Never touches the database. */
export function downloadSample(m: ModuleDef) {
  const cols = m.importCols!;
  downloadCsv(`${m.key}_sample.csv`, cols.map((c) => c.header), [
    cols.map((c) => c.example),
    cols.map((c) => `${c.required ? "REQUIRED. " : ""}${c.note ?? (c.type === "date" ? "dd-mm-yyyy" : "")}`.trim()),
  ]);
}

/** Export rows using import headers when possible (so exports can be re-imported). */
export function exportRows(m: ModuleDef, rows: Row[], sessionName?: string) {
  const headers = m.columns.map((c) => c.label);
  const data = rows.map((r) => m.columns.map((c) => {
    const v = c.money ? r[c.key] : c.value ? c.value(r) : c.render ? textOf(cellValue(c, r)) : r[c.key];
    return v ?? "";
  }));
  downloadCsv(`${m.key}${sessionName ? "_" + sessionName : ""}_${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
}
const textOf = (n: unknown) => (typeof n === "string" || typeof n === "number" ? n : "");

export type ParsedRow = { line: number; data: Row; virtual: Row; sessionId: string | null; errors: string[]; key: string };

export async function validateImport(m: ModuleDef, matrix: string[][], selectedSession: string | null, sessions: AcademicSession[]) {
  const cols = m.importCols!;
  const [head, ...body] = matrix;
  const idx = head.map((h) => h.trim().toLowerCase());
  const missingHeaders = cols.filter((c) => c.required && !idx.includes(c.header)).map((c) => c.header);
  // skip sample notes row if user left it in
  const rows = body.filter((r) => !r.some((c) => c.startsWith("REQUIRED.")));
  const kinds = cols.map((c) => c.type).filter((t): t is RefKind => REF_KINDS.includes(t as RefKind));
  const refs: RefMaps = await loadRefs(kinds, selectedSession);
  const virtualNames = new Set(m.fields.filter((f) => f.virtual).map((f) => f.name));
  const seen = new Set<string>();
  const parsed: ParsedRow[] = [];

  rows.forEach((r, i) => {
    const errors: string[] = [];
    const data: Row = {};
    const virtual: Row = {};
    let sessionId = m.sessionScoped ? selectedSession : null;
    for (const c of cols) {
      const pos = idx.indexOf(c.header);
      const raw = pos >= 0 ? (r[pos] ?? "").trim() : "";
      if (!raw) {
        if (c.required) errors.push(`${c.header} is required`);
        continue;
      }
      let val: unknown = raw;
      if (c.type === "number") {
        const n = Number(raw.replace(/[,₹\s]/g, ""));
        if (!Number.isFinite(n) || n < 0) { errors.push(`${c.header}: invalid number`); continue; }
        val = n;
      } else if (c.type === "date") {
        const d = parseDate(raw);
        if (!d) { errors.push(`${c.header}: invalid date (use dd-mm-yyyy)`); continue; }
        val = d;
      } else if (c.type === "month") {
        const mm = raw.match(/^(\d{1,2})[-/](\d{4})$/) ?? raw.match(/^(\d{4})-(\d{1,2})/);
        if (!mm) { errors.push(`${c.header}: use mm-yyyy`); continue; }
        val = mm[1].length === 4 ? `${mm[1]}-${mm[2].padStart(2, "0")}-01` : `${mm[2]}-${mm[1].padStart(2, "0")}-01`;
      } else if (c.type === "session") {
        const s = sessions.find((x) => x.name.toLowerCase() === raw.toLowerCase());
        if (!s) { errors.push(`Unknown session "${raw}"`); continue; }
        sessionId = s.id;
        continue;
      } else if (c.type && REF_KINDS.includes(c.type as RefKind)) {
        const ref = findRef(refs, c.type as RefKind, raw);
        if (!ref) { errors.push(`${c.header} "${raw}" not found`); continue; }
        val = ref.id;
      }
      if (virtualNames.has(c.field)) virtual[c.field] = val;
      else data[c.field] = val;
    }
    if (m.sessionScoped && !sessionId) errors.push("No session selected");
    if (m.key === "staff_sessions") {
      if (data.status === "active" && data.exit_date) errors.push("Active employment cannot have an exit date");
      if (data.status === "left" && !data.exit_date) errors.push("Exit date is required when status is Left");
      if (data.joining_date && data.exit_date && data.exit_date < data.joining_date) errors.push("Exit date cannot be before joining date");
    }
    const key = JSON.stringify([sessionId, data]);
    if (!errors.length && seen.has(key)) errors.push("Duplicate row inside file");
    seen.add(key);
    parsed.push({ line: i + 2, data, virtual, sessionId, errors, key });
  });
  return { missingHeaders, parsed };
}

export type ImportResult = { imported: number; duplicates: number; failed: number; errors: { line: number; error: string }[] };

export async function runImport(m: ModuleDef, rows: ParsedRow[], fileName: string, userEmail: string | undefined, invalid: number): Promise<ImportResult> {
  const res: ImportResult = { imported: 0, duplicates: 0, failed: 0, errors: [] };
  const queue = [...rows];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const ins: Row = { ...m.fixed, ...m.insertDefaults, ...r.data };
      if (m.sessionScoped) ins.session_id = r.sessionId;
      if (m.tokenized) ins.client_token = await hashUuid(m.key + r.key);
      const { data, error } = await db.from(m.table).insert(ins).select("id").single();
      if (error) {
        if (error.code === "23505") res.duplicates++;
        else { res.failed++; res.errors.push({ line: r.line, error: error.message }); }
        continue;
      }
      try {
        if (m.afterSave) await m.afterSave({ sessionId: r.sessionId ?? null, record: data as Row, values: r.virtual });
        res.imported++;
      } catch (e) {
        res.imported++;
        res.errors.push({ line: r.line, error: "Saved, but session link failed: " + (e as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  res.errors.sort((a, b) => a.line - b.line);
  await db.from("import_logs").insert({
    module: m.key, file_name: fileName, total_rows: rows.length + invalid, successful: res.imported,
    failed: res.failed + invalid, duplicates: res.duplicates, user_email: userEmail ?? null,
    status: res.failed + invalid === 0 ? "completed" : res.imported ? "partial" : "failed",
    errors: res.errors.slice(0, 200),
  });
  return res;
}

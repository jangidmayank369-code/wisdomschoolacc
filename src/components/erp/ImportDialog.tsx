import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseCsv } from "@/lib/csv";
import { useApp } from "@/lib/app-context";
import { downloadSample, runImport, validateImport, type ImportResult, type ParsedRow } from "@/lib/import-export";
import type { ModuleDef } from "@/lib/modules";
import { StatCard, StatGrid } from "./States";

type Step = "upload" | "preview" | "importing" | "done";

/** One reusable import engine UI: Upload → Preview/Validate → Confirm → Import → Result */
export function ImportDialog({ module: m, open, onOpenChange, onDone }: { module: ModuleDef; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const { session, sessions, user } = useApp();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");

  const reset = () => { setStep("upload"); setRows([]); setMissing([]); setResult(null); setErr(""); setFile(""); };
  const close = (o: boolean) => { if (step === "importing") return; onOpenChange(o); if (!o) reset(); };

  const onFile = async (f: File) => {
    setErr("");
    if (!f.name.toLowerCase().endsWith(".csv")) { setErr("Please choose a .csv file (save Excel sheets as CSV)."); return; }
    const text = await f.text();
    const matrix = parseCsv(text);
    if (matrix.length < 2) { setErr("The file has no data rows."); return; }
    setFile(f.name);
    const v = await validateImport(m, matrix, session?.id ?? null, sessions);
    setMissing(v.missingHeaders); setRows(v.parsed); setStep("preview");
  };

  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.filter((r) => r.errors.length);
  const fileDup = invalid.filter((r) => r.errors.includes("Duplicate row inside file")).length;

  const confirm = async () => {
    setStep("importing");
    const r = await runImport(m, valid, file, user?.email, invalid.length);
    setResult(r); setStep("done"); onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {m.title}</DialogTitle>
          <DialogDescription>
            {m.sessionScoped ? <>Rows without a <b>session</b> column go into <b>{session?.name ?? "—"}</b>. </> : null}
            Existing records are never overwritten — duplicates are skipped.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-accent/40">
              <span className="font-medium">Choose CSV file</span>
              <span className="text-xs text-muted-foreground">Use the sample file headers. Dates as dd-mm-yyyy.</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <Button variant="outline" size="sm" onClick={() => downloadSample(m)}>Download sample CSV</Button>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <StatGrid>
              <StatCard label="Total rows" value={rows.length} />
              <StatCard label="Valid" value={valid.length} tone="good" />
              <StatCard label="Invalid" value={invalid.length} tone={invalid.length ? "bad" : undefined} />
              <StatCard label="Duplicates in file" value={fileDup} tone={fileDup ? "warn" : undefined} />
            </StatGrid>
            {missing.length > 0 && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">Missing required columns: {missing.join(", ")}</p>}
            {invalid.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border text-xs">
                {invalid.slice(0, 200).map((r) => (
                  <div key={r.line} className="border-b px-2 py-1"><b>Row {r.line}:</b> {r.errors.join("; ")}</div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Only valid rows will be imported. Rows already in the system are reported as duplicates.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Choose another file</Button>
              <Button disabled={!valid.length || missing.length > 0} onClick={confirm}>Import {valid.length} rows</Button>
            </div>
          </div>
        )}

        {step === "importing" && <p className="py-8 text-center text-sm">Importing {valid.length} rows… please keep this window open.</p>}

        {step === "done" && result && (
          <div className="space-y-3">
            <StatGrid>
              <StatCard label="Total rows" value={rows.length} />
              <StatCard label="Imported" value={result.imported} tone="good" />
              <StatCard label="Already existed" value={result.duplicates} tone={result.duplicates ? "warn" : undefined} />
              <StatCard label="Failed" value={result.failed + invalid.length} tone={result.failed + invalid.length ? "bad" : undefined} />
            </StatGrid>
            {result.errors.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border text-xs">
                {result.errors.map((e, i) => <div key={i} className="border-b px-2 py-1"><b>Row {e.line}:</b> {e.error}</div>)}
              </div>
            )}
            <div className="flex justify-end"><Button onClick={() => close(false)}>Done</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

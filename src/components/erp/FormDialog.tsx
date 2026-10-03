import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { today, errMsg } from "@/lib/format";
import type { Field, Row } from "@/lib/modules";
import type { RefMaps } from "@/lib/refs";

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function initialValues(fields: Field[], record?: Row | null): Row {
  const v: Row = {};
  for (const f of fields) {
    const cur = record?.[f.name];
    if (cur != null) v[f.name] = f.type === "month" ? String(cur).slice(0, 7) : String(cur);
    else v[f.name] = f.default ?? (f.type === "date" && f.required ? today() : f.type === "month" && f.required ? today().slice(0, 7) : "");
  }
  return v;
}

/** Validate + convert form strings into DB values. Returns [values, errors]. */
export function normalize(fields: Field[], v: Row): [Row, Record<string, string>] {
  const out: Row = {};
  const errs: Record<string, string> = {};
  for (const f of fields) {
    const raw = (v[f.name] ?? "").toString().trim();
    if (!raw) {
      if (f.required) errs[f.name] = "Required";
      out[f.name] = null;
      continue;
    }
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) errs[f.name] = "Enter a valid non-negative number";
      out[f.name] = n;
    } else if (f.type === "month") out[f.name] = raw.slice(0, 7) + "-01";
    else out[f.name] = raw.slice(0, 500);
  }
  return [out, errs];
}

export function FormFields({ fields, values, setValues, errors, refs }: {
  fields: Field[]; values: Row; setValues: (v: Row) => void; errors: Record<string, string>; refs: RefMaps;
}) {
  const set = (k: string, val: string) => setValues({ ...values, [k]: val });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const wide = f.type === "textarea";
        let input;
        if (f.type === "select") {
          input = (
            <select id={id} className={selectCls} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">— Select —</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        } else if (f.type === "ref") {
          const opts = refs[f.ref!] ?? [];
          input = (
            <select id={id} className={selectCls} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">{opts.length ? "— Select —" : "No records yet"}</option>
              {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          );
        } else if (f.type === "textarea") {
          input = <Textarea id={id} rows={2} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />;
        } else {
          input = (
            <Input id={id} className="h-10" inputMode={f.type === "number" ? "decimal" : undefined}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "month" ? "month" : "text"}
              step={f.type === "number" ? "any" : undefined} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
          );
        }
        return (
          <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
            <Label htmlFor={id} className="mb-1 block text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
            {input}
            {errors[f.name] && <p className="mt-1 text-xs text-destructive">{errors[f.name]}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Shared dialog form. Prevents double submit; shows validation + server errors. */
export function FormDialog({ open, onOpenChange, title, fields, record, refs, onSubmit, submitLabel = "Save", intro }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; fields: Field[]; record?: Row | null; refs: RefMaps;
  onSubmit: (values: Row, raw: Row) => Promise<void>; submitLabel?: string; intro?: ReactNode;
}) {
  const [values, setValues] = useState<Row>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState("");

  useEffect(() => {
    if (open) { setValues(initialValues(fields, record)); setErrors({}); setServerErr(""); }
  }, [open, record, fields]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const [out, errs] = normalize(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerErr("");
    try { await onSubmit(out, values); onOpenChange(false); }
    catch (err) { setServerErr(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {intro}
          <FormFields fields={fields} values={values} setValues={setValues} errors={errors} refs={refs} />
          {serverErr && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{serverErr}</p>}
          <DialogFooter className="sticky bottom-0 gap-2 bg-background pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

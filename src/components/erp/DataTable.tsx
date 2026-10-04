import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import type { Column, Row } from "@/lib/modules";

export const cellValue = (c: Column, r: Row): ReactNode => {
  if (c.render) return c.render(r);
  const v = c.value ? c.value(r) : r[c.key];
  if (c.money) return inr(v as number);
  return v == null ? "" : String(v);
};

/** Shared table: desktop = table, mobile = cards. Client-side pagination. */
export function DataTable({ columns, rows, actions, onRowClick, pageSize = 25, rowClass, mobileColumnLimit = 8 }: {
  columns: Column[]; rows: Row[]; actions?: (r: Row) => ReactNode; onRowClick?: (r: Row) => void; pageSize?: number; rowClass?: (r: Row) => string; mobileColumnLimit?: number;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(page, pages - 1);
  const view = useMemo(() => rows.slice(p * pageSize, (p + 1) * pageSize), [rows, p, pageSize]);

  return (
    <div className="space-y-2">
      {/* mobile cards */}
      <div className="space-y-2 md:hidden">
        {view.map((r, i) => (
          <div key={r.id ?? i} className={`rounded-lg border bg-card p-3 ${rowClass?.(r) ?? ""}`} onClick={() => onRowClick?.(r)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-semibold">{cellValue(columns[0], r)}</div>
              <div className="shrink-0 text-sm font-medium">{columns[1] && cellValue(columns[1], r)}</div>
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              {columns.slice(2, mobileColumnLimit).map((c) => (
                <div key={c.key} className="min-w-0 truncate"><span className="text-muted-foreground">{c.label}: </span>{cellValue(c, r)}</div>
              ))}
            </dl>
            {actions && <div className="mt-2 flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>{actions(r)}</div>}
          </div>
        ))}
      </div>
      {/* desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 font-semibold ${c.money ? "text-right" : ""}`}>{c.label}</th>)}{actions && <th className="px-3 py-2" />}</tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={r.id ?? i} className={`border-t hover:bg-accent/40 ${onRowClick ? "cursor-pointer" : ""} ${rowClass?.(r) ?? ""}`} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => <td key={c.key} className={`px-3 py-2 ${c.money ? "text-right tabular-nums" : ""}`}>{cellValue(c, r)}</td>)}
                {actions && <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-3">{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="no-print flex items-center justify-between text-sm text-muted-foreground">
          <span>{rows.length} records · page {p + 1}/{pages}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" disabled={p === 0} onClick={() => setPage(p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

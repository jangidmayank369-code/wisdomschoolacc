import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/app-context";
import { errMsg } from "@/lib/format";
import type { MasterKind, Row } from "@/lib/modules";
import { MASTER_LABEL } from "./FormDialog";
import { ResourcePage } from "./ResourcePage";
import { Loading } from "./States";

type Tab = "fee" | MasterKind | "km";
const TABS: [Tab, string][] = [["fee", "Fee Categories"], ["maintenance_category", "Maintenance Categories"], ["staff_category", "Staff Categories"], ["designation", "Designations"], ["km", "Vehicle Daily KM Settings"]];

/** Admin-only master lists. No delete: deactivate instead; records keep their stored names. */
export function MastersPanel() {
  const [tab, setTab] = useState<Tab>("fee");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>)}
      </div>
      {tab === "km" ? <ResourcePage moduleKey="km_defaults" embedded title="Vehicle Daily KM Settings" /> : <MasterList key={tab} tab={tab} />}
    </div>
  );
}

function MasterList({ tab }: { tab: Exclude<Tab, "km"> }) {
  const qc = useQueryClient();
  const label = tab === "fee" ? "Fee Category" : MASTER_LABEL[tab];
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["master-admin", tab],
    queryFn: async () => {
      const r = tab === "fee"
        ? await db.from("fee_categories").select("id, name, is_active").order("name")
        : await db.from("master_items").select("id, name, is_active").eq("kind", tab).order("name");
      if (r.error) throw r.error;
      return r.data as Row[];
    },
  });
  const table = tab === "fee" ? "fee_categories" : "master_items";
  const done = () => { qc.invalidateQueries({ queryKey: ["master-admin", tab] }); qc.invalidateQueries({ queryKey: ["master"] }); qc.invalidateQueries({ queryKey: ["refs"] }); };

  const add = async () => {
    const name = prompt(`New ${label}`)?.trim();
    if (!name) return;
    const { error } = await db.from(table).insert(tab === "fee" ? { name } : { kind: tab, name });
    if (error) toast.error(errMsg(error)); else { toast.success(`${label} added`); done(); }
  };
  const rename = async (r: Row) => {
    const name = prompt(`Rename "${r.name}" (existing records keep their saved name)`, r.name)?.trim();
    if (!name || name === r.name) return;
    const { error } = await db.from(table).update({ name }).eq("id", r.id);
    if (error) toast.error(errMsg(error)); else { toast.success("Updated"); done(); }
  };
  const toggle = async (r: Row) => {
    if (r.is_active && !confirm(`Deactivate "${r.name}"? It will be hidden from new entries; existing records stay unchanged.`)) return;
    const { error } = await db.from(table).update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(errMsg(error)); else { toast.success(r.is_active ? "Deactivated" : "Activated"); done(); }
  };

  const rows = (list.data ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex gap-2">
        <Input className="h-10 flex-1" placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" className="h-10" onClick={add}>+ Add</Button>
      </div>
      {list.isLoading ? <Loading /> : list.error ? <p className="text-sm text-destructive">{errMsg(list.error)}</p> : !rows.length ? <p className="py-4 text-center text-sm text-muted-foreground">No data available</p> : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span className={r.is_active ? "" : "text-muted-foreground line-through"}>{r.name}{!r.is_active && <span className="ml-2 text-xs no-underline">(inactive)</span>}</span>
              <span className="flex gap-3">
                <button className="text-sm text-primary underline" onClick={() => rename(r)}>Edit</button>
                <button className={`text-sm underline ${r.is_active ? "text-destructive" : "text-success"}`} onClick={() => toggle(r)}>{r.is_active ? "Deactivate" : "Activate"}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

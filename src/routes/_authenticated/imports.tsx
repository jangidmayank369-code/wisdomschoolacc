import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { IMPORT_MODULES, type ModuleDef } from "@/lib/modules";
import { downloadSample, exportRows } from "@/lib/import-export";
import { errMsg } from "@/lib/format";
import { ImportDialog } from "@/components/erp/ImportDialog";
import { DataTable } from "@/components/erp/DataTable";
import { Empty, Loading, PageHeader, Section } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({ meta: [{ title: "Import Center — WPS Doomra ERP" }] }),
  component: Imports,
});

function Imports() {
  const { session, roles } = useApp();
  const qc = useQueryClient();
  const [mod, setMod] = useState<ModuleDef | null>(null);
  const logs = useQuery({
    queryKey: ["mod", "import_logs"],
    queryFn: async () => (await db.from("import_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const doExport = async (m: ModuleDef) => {
    let q = db.from(m.table).select(m.select);
    if (m.sessionScoped && session) q = q.eq("session_id", session.id);
    for (const [k, v] of Object.entries(m.fixed ?? {})) q = q.eq(k, v);
    const { data, error } = await q.limit(20000);
    if (error) return toast.error(errMsg(error));
    if (!data?.length) return toast.info("No data to export");
    exportRows(m, data as Record<string, unknown>[], session?.name);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import Center" subtitle={`Session-specific imports go into ${session?.name ?? "—"} unless the file has a "session" column.`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_MODULES.map((m) => {
          const canWrite = m.writeRoles.some((r) => roles.includes(r) && r !== "staff");
          return (
            <div key={m.key} className="rounded-lg border bg-card p-3">
              <div className="font-semibold">{m.title}</div>
              <div className="mb-2 text-xs text-muted-foreground">{m.sessionScoped ? "Session data" : "Master records"} · {m.importCols!.length} columns</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadSample(m)}>Sample</Button>
                {canWrite && <Button size="sm" onClick={() => setMod(m)}>Import</Button>}
                <Button size="sm" variant="outline" onClick={() => doExport(m)}>Export</Button>
              </div>
            </div>
          );
        })}
      </div>
      <Section title="Import history">
        {logs.isLoading ? <Loading /> : !logs.data?.length ? <Empty text="No imports yet" /> : (
          <DataTable rows={logs.data} columns={[
            { key: "created_at", label: "Date", value: (r) => new Date(r.created_at).toLocaleString("en-IN") },
            { key: "module", label: "Module" }, { key: "file_name", label: "File" }, { key: "total_rows", label: "Rows" },
            { key: "successful", label: "Imported" }, { key: "duplicates", label: "Duplicates" }, { key: "failed", label: "Failed" },
            { key: "user_email", label: "User" }, { key: "status", label: "Status" },
          ]} />
        )}
      </Section>
      {mod && <ImportDialog module={mod} open={!!mod} onOpenChange={(o) => !o && setMod(null)} onDone={() => qc.invalidateQueries({ queryKey: ["mod"] })} />}
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { errMsg, fmtDate } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { createUserAccount, listUsers } from "@/lib/users.functions";
import type { Field, Row } from "@/lib/modules";
import { DataTable } from "@/components/erp/DataTable";
import { FormDialog, FormFields } from "@/components/erp/FormDialog";
import { Empty, Loading, PageHeader, Section } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — WPS Doomra ERP" }] }),
  component: Settings,
});

const sessionFields: Field[] = [
  { name: "name", label: "Session name (e.g. 2025-26)", type: "text", required: true },
  { name: "start_date", label: "Start date", type: "date", required: true },
  { name: "end_date", label: "End date", type: "date", required: true },
];
const schoolFields: Field[] = [
  { name: "school_name", label: "School name", type: "text", required: true },
  { name: "phone", label: "Phone", type: "text" }, { name: "email", label: "Email", type: "text" },
  { name: "logo_url", label: "Logo URL", type: "text" }, { name: "address", label: "Address", type: "textarea" },
  { name: "receipt_footer", label: "Receipt footer", type: "textarea" },
];
const userFields: Field[] = [
  { name: "full_name", label: "Full name", type: "text", required: true },
  { name: "email", label: "Email", type: "text", required: true },
  { name: "password", label: "Password (min 8)", type: "text", required: true },
  { name: "role", label: "Role", type: "select", options: ["admin", "accountant", "staff"], required: true, default: "staff" },
  { name: "staff_id", label: "Link to staff record (for staff role)", type: "ref", ref: "staff" },
];

function Settings() {
  const { sessions, reload, isAdmin } = useApp();
  const qc = useQueryClient();
  const [addSession, setAddSession] = useState(false);
  const [addUser, setAddUser] = useState(false);
  const [school, setSchool] = useState<Row>({});
  const listUsersFn = useServerFn(listUsers);
  const createUserFn = useServerFn(createUserAccount);

  const settings = useQuery({ queryKey: ["settings"], queryFn: async () => (await db.from("school_settings").select("*").eq("id", 1).single()).data });
  useEffect(() => { if (settings.data) setSchool(Object.fromEntries(schoolFields.map((f) => [f.name, settings.data?.[f.name] ?? ""]))); }, [settings.data]);
  const users = useQuery({ queryKey: ["users"], enabled: isAdmin, queryFn: () => listUsersFn() });
  const staffRefs = useQuery({ queryKey: ["refs", "staff-all"], enabled: addUser, queryFn: () => loadRefs(["staff"], null) });

  const setCurrent = async (id: string) => {
    await db.from("academic_sessions").update({ is_current: false }).eq("is_current", true);
    const { error } = await db.from("academic_sessions").update({ is_current: true }).eq("id", id);
    if (error) toast.error(errMsg(error)); else { toast.success("Current session updated"); reload(); }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" />
      <Section title="Academic sessions" actions={<Button size="sm" onClick={() => setAddSession(true)}>Add session</Button>}>
        {!sessions.length ? <Empty text="No sessions yet. Add your first session to begin." /> : (
          <DataTable rows={sessions} columns={[
            { key: "name", label: "Session" }, { key: "start_date", label: "Start", render: (r) => fmtDate(r.start_date) },
            { key: "end_date", label: "End", render: (r) => fmtDate(r.end_date) }, { key: "is_current", label: "Current", render: (r) => (r.is_current ? "✓ Current" : "") },
          ]} actions={(r) => !r.is_current ? <button className="text-sm text-primary underline" onClick={() => setCurrent(r.id)}>Make current</button> : null} />
        )}
      </Section>

      <Section title="School details">
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <FormFields fields={schoolFields} values={school} setValues={setSchool} errors={{}} refs={{}} />
          <Button onClick={async () => {
            const { error } = await db.from("school_settings").update({ ...school, updated_at: new Date().toISOString() }).eq("id", 1);
            if (error) toast.error(errMsg(error)); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] }); }
          }}>Save school details</Button>
        </div>
      </Section>

      <Section title="Users & roles" actions={<Button size="sm" onClick={() => setAddUser(true)}>Add user</Button>}>
        {users.isLoading ? <Loading /> : users.error ? <p className="text-sm text-destructive">{errMsg(users.error)}</p> : (
          <DataTable rows={(users.data ?? []) as Row[]} columns={[
            { key: "full_name", label: "Name" }, { key: "email", label: "Email" }, { key: "roles", label: "Roles", value: (r) => r.roles.join(", ") },
            { key: "staff", label: "Staff link", value: (r) => (r.staff ? `${r.staff.name} (${r.staff.employee_id})` : "") },
          ]} />
        )}
      </Section>

      <FormDialog open={addSession} onOpenChange={setAddSession} title="Add academic session" fields={sessionFields} refs={{}}
        onSubmit={async (v) => {
          const { error } = await db.from("academic_sessions").insert({ ...v, is_current: sessions.length === 0 });
          if (error) throw error;
          toast.success("Session created"); await reload();
        }} />
      <FormDialog open={addUser} onOpenChange={setAddUser} title="Create user login" fields={userFields} refs={staffRefs.data ?? {}}
        onSubmit={async (v) => {
          await createUserFn({ data: { email: v.email, password: v.password, full_name: v.full_name, role: v.role, staff_id: v.staff_id || null } });
          toast.success("User created. Share the email & password with them.");
          qc.invalidateQueries({ queryKey: ["users"] });
        }} />
    </div>
  );
}

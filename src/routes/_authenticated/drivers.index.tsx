import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, useApp } from "@/lib/app-context";
import { dailySalary } from "@/lib/finance";
import { salaryInr } from "@/lib/format";
import { DataTable } from "@/components/erp/DataTable";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/drivers/")({
  head: () => ({ meta: [{ title: "Drivers — WPS Doomra ERP" }] }),
  component: Drivers,
});

function Drivers() {
  const { session } = useApp();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["mod", "drivers", session?.id],
    enabled: !!session,
    queryFn: async () => {
      const [ss, va] = await Promise.all([
        db.from("staff_sessions").select("*, staff(employee_id, name, mobile)").eq("session_id", session!.id).eq("status", "active").or("designation.ilike.driver,optional_role.ilike.driver"),
        db.from("vehicle_assignments").select("staff_id, route, vehicles(vehicle_no)").eq("session_id", session!.id),
      ]);
      if (ss.error) throw ss.error;
       const now = new Date().toISOString().slice(0, 10);
       return (ss.data ?? []).filter((r) => (!r.joining_date || r.joining_date <= now) && (!r.exit_date || r.exit_date >= now)).map((r) => ({ ...r, va: (va.data ?? []).find((v) => v.staff_id === r.staff_id) }));
    },
  });
  return (
    <div>
      <PageHeader title="Drivers" subtitle={`Staff with designation "Driver" in ${session?.name ?? "—"}`} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : !q.data?.length ? <Empty text="No drivers in this session. Add staff employment with designation Driver." /> : (
        <DataTable rows={q.data} onRowClick={(r) => nav({ to: "/drivers/$id", params: { id: r.staff_id } })} columns={[
          { key: "n", label: "Driver", value: (r) => `${r.staff?.name} (${r.staff?.employee_id})` },
          { key: "v", label: "Vehicle", value: (r) => r.va?.vehicles?.vehicle_no ?? "Not assigned" },
          { key: "route", label: "Route", value: (r) => r.va?.route ?? "" },
           { key: "monthly_salary", label: "Salary", render: (r) => salaryInr(r.monthly_salary) },
           { key: "d", label: "Daily", value: (r) => salaryInr(dailySalary(r.monthly_salary)) },
          { key: "m", label: "Mobile", value: (r) => r.staff?.mobile },
        ]} />
      )}
    </div>
  );
}

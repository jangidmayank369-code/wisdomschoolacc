import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { StaffProfileView } from "@/components/erp/StaffProfileView";
import { Empty } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({ meta: [{ title: "My Dashboard — WPS Doomra ERP" }] }),
  component: My,
});

function My() {
  const { staffId } = useApp();
  if (!staffId) return <Empty text="Your login is not linked to a staff record. Please contact the admin." />;
  return <StaffProfileView staffId={staffId} self />;
}

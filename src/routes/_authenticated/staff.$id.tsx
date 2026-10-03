import { createFileRoute } from "@tanstack/react-router";
import { StaffProfileView } from "@/components/erp/StaffProfileView";

export const Route = createFileRoute("/_authenticated/staff/$id")({
  head: () => ({ meta: [{ title: "Staff Profile — WPS Doomra ERP" }] }),
  component: () => <StaffProfileView staffId={Route.useParams().id} />,
});

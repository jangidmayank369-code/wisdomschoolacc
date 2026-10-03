import { createFileRoute } from "@tanstack/react-router";
import { StaffProfileView } from "@/components/erp/StaffProfileView";

export const Route = createFileRoute("/_authenticated/drivers/$id")({
  head: () => ({ meta: [{ title: "Driver Profile — WPS Doomra ERP" }] }),
  component: () => <StaffProfileView staffId={Route.useParams().id} driver />,
});

import { createFileRoute, notFound } from "@tanstack/react-router";
import { getModule } from "@/lib/modules";
import { ResourcePage } from "@/components/erp/ResourcePage";

export const Route = createFileRoute("/_authenticated/m/$module")({
  beforeLoad: ({ params }) => { if (!getModule(params.module)) throw notFound(); },
  head: ({ params }) => ({ meta: [{ title: `${getModule(params.module)?.title ?? "Module"} — WPS Doomra ERP` }] }),
  component: Page,
  notFoundComponent: () => <p className="p-6 text-sm">Module not found.</p>,
});

function Page() {
  const { module } = Route.useParams();
  return <ResourcePage key={module} moduleKey={module} />;
}

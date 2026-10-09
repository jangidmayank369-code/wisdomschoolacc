import { createFileRoute, notFound } from "@tanstack/react-router";
import { getModule } from "@/lib/modules";
import { ResourcePage } from "@/components/erp/ResourcePage";
import { StationeryIssue } from "@/components/erp/StationeryIssue";

export const Route = createFileRoute("/_authenticated/m/$module")({
  beforeLoad: ({ params }) => { if (!getModule(params.module)) throw notFound(); },
  head: ({ params }) => { const title = `${getModule(params.module)?.title ?? "Module"} — WPS Doomra ERP`; const description = `Selected-session ${getModule(params.module)?.title ?? "records"} for Wisdom Public School, Doomra.`; return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }; },
  component: Page,
  notFoundComponent: () => <p className="p-6 text-sm">Module not found.</p>,
});

function Page() {
  const { module } = Route.useParams();
  if (getModule(module)?.customView === "stationery") return <StationeryIssue />;
  return <ResourcePage key={module} moduleKey={module} />;
}

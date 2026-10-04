import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { db, useApp } from "@/lib/app-context";
import { fuelEstimate, sum } from "@/lib/finance";
import { fmtMonth, inr } from "@/lib/format";
import type { Row } from "@/lib/modules";
import { DataTable } from "@/components/erp/DataTable";
import { ResourcePage } from "@/components/erp/ResourcePage";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/fuel")({
  head: () => ({ meta: [{ title: "Fuel & Transport — WPS Doomra ERP" }, { name: "description", content: "Daily KM, monthly fuel rates, fuel estimates and actual fuel expenses." }] }),
  component: FuelPage,
});

const TABS = [["km", "Daily KM"], ["rates", "Fuel Rates"], ["summary", "Fuel Summary"], ["exp", "Actual Fuel Expenses"]] as const;

function FuelPage() {
  const { session } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("summary");
  return (
    <div className="space-y-4">
      <PageHeader title="Fuel & Transport" subtitle={`Showing data for: ${session?.name ?? "—"}`} />
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>)}
      </div>
      {tab === "km" && <ResourcePage moduleKey="driver_km_logs" embedded title="Daily KM" />}
      {tab === "rates" && <ResourcePage moduleKey="fuel_rates" embedded title="Fuel Rates" />}
      {tab === "exp" && <ResourcePage moduleKey="transport_expenses" embedded title="Actual Fuel / Transport Expenses" />}
      {tab === "summary" && <FuelSummary />}
    </div>
  );
}

function FuelSummary() {
  const { session } = useApp();
  const sid = session?.id;
  const q = useQuery({
    queryKey: ["fuel-summary", sid],
    enabled: !!sid,
    queryFn: async () => {
      const [km, rates, exp, veh] = await Promise.all([
        db.from("driver_km_logs").select("date, km, vehicle_id").eq("session_id", sid!),
        db.from("fuel_rates").select("month, fuel_type, rate_per_litre").eq("session_id", sid!).eq("status", "active"),
        db.from("transport_expenses").select("date, amount, vehicle_id").eq("session_id", sid!).eq("is_reversed", false).eq("expense_type", "Fuel"),
        db.from("vehicles").select("id, vehicle_no, fuel_average_kmpl"),
      ]);
      const err = km.error ?? rates.error ?? exp.error ?? veh.error;
      if (err) throw err;
      const vmap = new Map((veh.data as Row[]).map((v) => [v.id, v]));
       const rateFor = (m: string) => {
         const monthRates = (rates.data as Row[]).filter((r) => r.month.slice(0, 7) === m);
         return monthRates.length === 1 ? monthRates[0] : monthRates.find((r) => r.fuel_type === "Diesel");
       };
      const keys = new Map<string, Row>();
      const add = (date: string, vid: string | null) => {
        const k = `${date.slice(0, 7)}|${vid ?? ""}`;
        if (!keys.has(k)) keys.set(k, { id: k, month: date.slice(0, 7), vid, km: 0, actual: 0 });
        return keys.get(k)!;
      };
      for (const r of km.data as Row[]) add(r.date, r.vehicle_id).km += Number(r.km);
      for (const r of exp.data as Row[]) add(r.date, r.vehicle_id).actual += Number(r.amount);
      return [...keys.values()].sort((a, b) => (a.month < b.month ? -1 : 1)).map((r) => {
        const v = r.vid ? vmap.get(r.vid) : null;
        const rate = rateFor(r.month);
        const est = fuelEstimate(r.km, v?.fuel_average_kmpl, rate?.rate_per_litre);
         return { ...r, rawKm: r.km as number, km: est.km, actual: r.actual as number, vehicle: v?.vehicle_no ?? "—", avg: v?.fuel_average_kmpl ?? null, rate: rate ? Number(rate.rate_per_litre) : null, litres: est.litres, cost: est.cost, diff: est.cost != null ? Math.round((r.actual - est.cost) * 100) / 100 : null };
      });
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const rows = q.data ?? [];
  if (!rows.length) return <Empty text="No data available" />;
  const dash = (v: unknown, f: (n: number) => string) => (v == null ? "—" : f(Number(v)));
  return (
    <div className="space-y-2">
       <p className="text-sm text-muted-foreground">Estimate = rounded monthly KM ÷ vehicle average × that month's fuel rate. Accounts always use the actual fuel expense.</p>
      <DataTable rows={rows} columns={[
        { key: "month", label: "Month", value: (r) => fmtMonth(r.month + "-01") }, { key: "vehicle", label: "Vehicle" },
        { key: "km", label: "Total KM", value: (r) => r.km.toLocaleString("en-IN") },
        { key: "avg", label: "Average", value: (r) => dash(r.avg, (n) => `${n} KM/L`) },
        { key: "litres", label: "Est. litres", value: (r) => dash(r.litres, (n) => `${n.toFixed(2)} L`) },
         { key: "rate", label: "Rate / L", value: (r) => r.rate == null ? "Fuel rate not set" : `${inr(r.rate)}/L` },
        { key: "cost", label: "Est. cost", value: (r) => dash(r.cost, inr) },
        { key: "actual", label: "Actual expense", value: (r) => inr(r.actual) },
         { key: "diff", label: "Fuel Cost Difference", value: (r) => dash(r.diff, inr) },
      ]} />
       <p className="text-sm">Session totals — KM {Math.round(sum(rows, (r) => r.rawKm)).toLocaleString("en-IN")} · Est. cost {inr(sum(rows, (r) => r.cost))} · Actual {inr(sum(rows, (r) => r.actual))}</p>
    </div>
  );
}

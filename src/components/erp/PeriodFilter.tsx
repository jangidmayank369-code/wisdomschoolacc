import { Input } from "@/components/ui/input";
import { PERIODS, type Period } from "@/lib/period";

export function PeriodFilter({ period, setPeriod, custom, setCustom }: {
  period: Period; setPeriod: (p: Period) => void; custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void;
}) {
  return (
    <div className="no-print flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <select aria-label="Period" className="h-10 max-w-full rounded-md border border-input bg-background px-2 text-base sm:text-sm" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
        {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
      </select>
      {period === "custom" && (
        <>
          <Input type="date" className="h-10 w-[150px] max-w-full" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <Input type="date" className="h-10 w-[150px] max-w-full" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </>
      )}
    </div>
  );
}

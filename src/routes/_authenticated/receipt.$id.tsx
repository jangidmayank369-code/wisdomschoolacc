import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/app-context";
import { fmtDate, inr } from "@/lib/format";
import { ErrorState, Loading } from "@/components/erp/States";

export const Route = createFileRoute("/_authenticated/receipt/$id")({
  head: () => ({ meta: [{ title: "Fee Receipt — WPS Doomra ERP" }] }),
  component: Receipt,
});

const SIZES = { A4: "max-w-[210mm]", A5: "max-w-[148mm]", "80mm": "max-w-[80mm] text-xs" } as const;

function Receipt() {
  const { id } = Route.useParams();
  const [size, setSize] = useState<keyof typeof SIZES>("A5");
  const q = useQuery({
    queryKey: ["profile", "receipt", id],
    queryFn: async () => {
      const { data: p, error } = await db.from("fee_payments").select("*, students(name, admission_no, father_name), fee_categories(name), academic_sessions(name)").eq("id", id).single();
      if (error) throw error;
      const [en, bal, set] = await Promise.all([
        db.from("student_sessions").select("class, section, roll_no").eq("student_id", p.student_id).eq("session_id", p.session_id).maybeSingle(),
        db.from("v_student_balances").select("total_charges, total_paid").eq("student_id", p.student_id).eq("session_id", p.session_id).maybeSingle(),
        db.from("school_settings").select("*").eq("id", 1).single(),
      ]);
      return { p, en: en.data, bal: bal.data, set: set.data };
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const { p, en, bal, set } = q.data!;
  const balance = bal ? Number(bal.total_charges) - Number(bal.total_paid) : 0;
  const rows: [string, string][] = [
    ["Receipt No", p.receipt_no], ["Date", fmtDate(p.payment_date)], ["Session", p.academic_sessions?.name],
    ["Student", p.students?.name], ["Adm/SR No", p.students?.admission_no], ["Father", p.students?.father_name ?? "—"],
    ["Class", en ? `${en.class}${en.section ? "-" + en.section : ""}` : "—"], ["Fee", p.fee_categories?.name ?? "Fees"],
    ["Payment mode", p.mode + (p.reference ? ` (${p.reference})` : "")], ["Received by", p.received_by ?? "—"],
  ];
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2">
        {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((s) => <Button key={s} size="sm" variant={s === size ? "default" : "outline"} onClick={() => setSize(s)}>{s}</Button>)}
        <Button size="sm" onClick={() => window.print()}>Print</Button>
        <Button size="sm" variant="outline" onClick={() => history.back()}>Back</Button>
      </div>
      <div className={`print-area mx-auto rounded-lg border bg-card p-5 ${SIZES[size]}`}>
        <div className="border-b pb-3 text-center">
          {set?.logo_url && <img src={set.logo_url} alt="School logo" className="mx-auto mb-1 h-12" />}
          <div className="text-lg font-extrabold text-primary">{set?.school_name}</div>
          {set?.address && <div className="text-xs">{set.address}</div>}
          {set?.phone && <div className="text-xs">Ph: {set.phone}</div>}
          <div className="mt-1 text-sm font-semibold uppercase tracking-wider">Fee Receipt</div>
          {p.is_reversed && <div className="font-bold text-destructive">REVERSED / CANCELLED</div>}
        </div>
        <dl className="my-3 space-y-1">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
        <div className="flex justify-between border-y py-2 text-base font-bold"><span>Amount paid</span><span>{inr(p.amount)}</span></div>
        <div className="mt-2 flex justify-between"><span>Balance due</span><b>{inr(balance)}</b></div>
        {p.remarks && <p className="mt-2 text-xs">Remarks: {p.remarks}</p>}
        <div className="mt-8 flex justify-between text-xs"><span>{set?.receipt_footer}</span><span className="border-t px-4 pt-1">Signature</span></div>
      </div>
    </div>
  );
}

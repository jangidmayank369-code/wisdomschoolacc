import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { db, useApp } from "@/lib/app-context";
import { errMsg, inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Empty, ErrorState, Loading, PageHeader, Section } from "./States";
import { StationeryHistory } from "./StationeryHistory";

type Student = { student_id: string; class: string; students: { name: string; admission_no: string; father_name: string | null; mother_name: string | null } };
type Item = { key: string; name: string; quantity: string; price: string };
const blank = (): Item => ({ key: crypto.randomUUID(), name: "", quantity: "1", price: "" });

export function StationeryIssue() {
  const { session, isAdmin, isFinance } = useApp();
  if (!session) return <Empty text="Select an academic session." />;
  if (!isFinance) return <Empty text="Access restricted." />;
  return <StationeryForm key={session.id} sessionId={session.id} sessionName={session.name} canIssue={isAdmin} />;
}
function StationeryForm({ sessionId, sessionName, canIssue }: { sessionId: string; sessionName: string; canIssue: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const issueId = useRef<string | null>(null);
  const students = useQuery({ queryKey: ["stationery-students", sessionId], enabled: canIssue, queryFn: async () => {
    const r = await db.from("student_sessions").select("student_id, class, students!inner(name, admission_no, father_name, mother_name)").eq("session_id", sessionId).limit(20000);
    if (r.error) throw r.error;
    return r.data as unknown as Student[];
  }});
  const total = Math.round(items.reduce((n, i) => n + Number(i.quantity || 0) * Number(i.price || 0), 0) * 100) / 100;
  const valid = !!student && items.length > 0 && items.every((i) => i.name.trim().length > 0 && i.name.trim().length <= 100 && Number.isInteger(Number(i.quantity)) && Number(i.quantity) > 0 && Number(i.quantity) <= 100000 && i.price !== "" && Number.isFinite(Number(i.price)) && Number(i.price) >= 0 && Number(i.price) <= 10000000 && Math.abs(Number(i.price) * 100 - Math.round(Number(i.price) * 100)) < 0.00001) && total > 0;
  const change = (key: string, field: keyof Item, value: string) => { issueId.current = null; setItems((old) => old.map((i) => i.key === key ? { ...i, [field]: value } : i)); };
  const save = async () => {
    if (busy.current || !valid || !student) return;
    busy.current = true; setSaving(true);
    issueId.current ??= crypto.randomUUID();
    try {
      const r = await db.rpc("issue_stationery", { _id: issueId.current, _student_id: student.student_id, _session_id: sessionId, _items: items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), price: Number(i.price) })) });
      if (r.error) throw r.error;
      toast.success("Stationery charge saved — unpaid");
      setConfirming(false); setStudent(null); setItems([]); setSearch(""); issueId.current = null;
      for (const key of ["stationery", "mod", "profile", "dash", "refs"]) await qc.invalidateQueries({ queryKey: [key] });
    } catch (e) { toast.error(errMsg(e)); } finally { busy.current = false; setSaving(false); }
  };
  const matches = search.trim() ? (students.data ?? []).filter((s) => `${s.students.name} ${s.students.admission_no}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 30) : [];
  return <div className="space-y-6">
    <PageHeader title="Stationery Issue" subtitle={`Issue notebooks, pencils and other stationery to a student. · ${sessionName}`} />
    {canIssue && <Section title="Find student">
      {!student ? <div className="space-y-3"><div className="relative"><Search className="absolute left-3 top-4 h-5 w-5 text-muted-foreground" /><Input className="h-12 pl-10" aria-label="Search student by Name or SR No." placeholder="Search student by Name or SR No." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {students.isLoading ? <Loading /> : students.error ? <ErrorState error={students.error} /> : search.trim() && !matches.length ? <Empty text="No matching student in this session." /> : <div className="grid gap-2 sm:grid-cols-2">{matches.map((s) => <Button key={s.student_id} variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => { setStudent(s); setItems([blank()]); issueId.current = null; }}><span><strong>{s.students.name}</strong><span className="block text-xs text-muted-foreground">SR No. {s.students.admission_no} · Class {s.class}<br />{s.students.father_name || s.students.mother_name || ""}</span></span></Button>)}</div>}
      </div> : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"><div><strong>{student.students.name}</strong><p className="text-sm text-muted-foreground">SR No. {student.students.admission_no} · Class {student.class}</p></div><Button variant="outline" onClick={() => { setStudent(null); issueId.current = null; }}>Change student</Button></div>
        <div className="space-y-3">{items.map((i, index) => <div key={i.key} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
          <label className="text-sm">Item name<Input aria-label={`Item ${index + 1} name`} maxLength={100} value={i.name} onChange={(e) => change(i.key, "name", e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3 sm:contents"><label className="text-sm">Quantity<Input aria-label={`Item ${index + 1} quantity`} type="number" inputMode="numeric" min="1" step="1" value={i.quantity} onChange={(e) => change(i.key, "quantity", e.target.value)} /></label><label className="text-sm">Price per item (₹)<Input aria-label={`Item ${index + 1} price`} type="number" inputMode="decimal" min="0" step="0.01" value={i.price} onChange={(e) => change(i.key, "price", e.target.value)} /></label></div>
          <div className="flex items-center justify-between gap-3 sm:pt-5"><strong>{inr(Number(i.quantity || 0) * Number(i.price || 0))}</strong><Button variant="ghost" size="icon" aria-label={`Remove unsaved item ${index + 1}`} title="Remove unsaved item" onClick={() => { issueId.current = null; setItems(items.filter((r) => r.key !== i.key)); }}><Trash2 /></Button></div>
        </div>)}</div>
        <Button variant="outline" className="h-11 w-full" disabled={items.length >= 50} onClick={() => { issueId.current = null; setItems([...items, blank()]); }}><Plus />Add Item</Button>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t py-4"><div><p className="text-xs font-semibold text-muted-foreground">TOTAL STATIONERY CHARGES</p><strong className="text-2xl text-primary">{inr(total)}</strong></div><Button className="h-12 min-w-40" disabled={!valid || saving} onClick={() => setConfirming(true)}><NotebookPen />Save issue</Button></div>
        {total === 0 && items.length > 0 && <p className="text-sm text-muted-foreground">At least one priced item is needed to create a fee charge. Free items may be included.</p>}
      </div>}
    </Section>}
    <Section title="Recent stationery issues"><Input className="mb-3 h-11" aria-label="Search stationery history" placeholder="Search student by Name or SR No." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} /><StationeryHistory search={historySearch} /></Section>
    <AlertDialog open={confirming} onOpenChange={(open) => { if (!saving) setConfirming(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm stationery issue</AlertDialogTitle><AlertDialogDescription>Add {inr(total)} stationery charges to this student's account?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><Button disabled={saving || !valid} onClick={save}>{saving ? "Saving…" : "Confirm"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
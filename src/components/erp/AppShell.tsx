import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, GraduationCap, IndianRupee, Briefcase, Wallet, CalendarCheck, CalendarOff, Bus, Gauge, Fuel,
  Wrench, BookOpen, Upload, FileBarChart, Settings, LogOut, Menu, X, Receipt, User, Truck, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { SchoolLogo } from "./SchoolLogo";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof Users; roles: ("admin" | "accountant" | "staff")[] };
const A = ["admin"] as NavItem["roles"];
const F = ["admin", "accountant"] as NavItem["roles"];

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: F },
    { to: "/my", label: "My Dashboard", icon: User, roles: ["staff"] },
  ] },
  { group: "Students", items: [
    { to: "/m/students", label: "Students", icon: GraduationCap, roles: F },
    { to: "/m/student_sessions", label: "Class Lists", icon: ClipboardList, roles: F },
    { to: "/m/student_charges", label: "Charges", icon: Receipt, roles: F },
    { to: "/m/fee_payments", label: "Fee Payments", icon: IndianRupee, roles: F },
  ] },
  { group: "Staff", items: [
    { to: "/m/staff", label: "Staff", icon: Users, roles: A },
    { to: "/m/staff_sessions", label: "Employment", icon: Briefcase, roles: A },
    { to: "/payroll", label: "Payroll", icon: Wallet, roles: A },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: A },
    { to: "/m/leave_requests", label: "Leave", icon: CalendarOff, roles: ["admin", "staff"] },
  ] },
  { group: "Transport", items: [
    { to: "/drivers", label: "Drivers", icon: Truck, roles: A },
    { to: "/m/vehicles", label: "Vehicles", icon: Bus, roles: A },
    { to: "/m/vehicle_assignments", label: "Assignments", icon: ClipboardList, roles: A },
    { to: "/m/monthly_vehicle_km", label: "Monthly KM", icon: Gauge, roles: A },
    { to: "/fuel", label: "Fuel & Transport", icon: Fuel, roles: A },
  ] },
  { group: "Finance", items: [
    { to: "/m/maintenance_expenses", label: "Maintenance", icon: Wrench, roles: A },
    { to: "/m/income", label: "Other Income", icon: IndianRupee, roles: F },
    { to: "/m/expenses", label: "Other Expenses", icon: Wallet, roles: F },
    { to: "/m/accounts", label: "Accounts", icon: BookOpen, roles: F },
  ] },
  { group: "System", items: [
    { to: "/imports", label: "Import Center", icon: Upload, roles: F },
    { to: "/reports", label: "Reports", icon: FileBarChart, roles: F },
    { to: "/settings", label: "Settings", icon: Settings, roles: A },
  ] },
];

function SessionSelect() {
  const { sessions, session, setSessionId } = useApp();
  if (!sessions.length) return <span className="text-xs text-muted-foreground">No session</span>;
  return (
    <select aria-label="Academic session" className="h-9 max-w-[42vw] rounded-md border border-input bg-background px-2 text-base font-semibold text-primary sm:max-w-none sm:text-sm"
      value={session?.id ?? ""} onChange={(e) => setSessionId(e.target.value)}>
      {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>)}
    </select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { roles, user, isFinance } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const allowed = (i: NavItem) => i.roles.some((r) => roles.includes(r));
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const nav = (
    <nav className="space-y-4 p-3">
      {groups.map((g) => (
        <div key={g.group}>
          {g.group && <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{g.group}</div>}
          {g.items.map((i) => {
            const active = loc.pathname === i.to || loc.pathname.startsWith(i.to + "/");
            return (
              <Link key={i.to} to={i.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"}`}>
                <i.icon className="h-4 w-4" />{i.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const quick = isFinance
    ? [{ to: "/dashboard", label: "Home", icon: LayoutDashboard }, { to: "/m/students", label: "Students", icon: GraduationCap }, { to: "/m/fee_payments", label: "Fees", icon: IndianRupee }, { to: "/m/accounts", label: "Accounts", icon: BookOpen }]
    : [{ to: "/my", label: "Home", icon: User }, { to: "/m/leave_requests", label: "Leave", icon: CalendarOff }];

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-background">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-sidebar lg:flex">
        <Brand />
        {nav}
      </aside>
      {open && (
        <div className="no-print fixed inset-0 z-[10000] h-dvh lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside aria-label="School menu" className="absolute inset-y-0 left-0 h-dvh w-full max-w-sm overflow-y-auto overscroll-contain bg-sidebar pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between pr-2"><Brand /><Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)} className="shrink-0 text-sidebar-foreground"><X /></Button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="min-w-0 max-w-full lg:pl-60">
        <header className="no-print sticky top-0 z-20 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2"><button aria-label="Open menu" className="shrink-0 lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
           <SchoolLogo className="h-10 w-9 shrink-0 lg:hidden" decorative /><span className="truncate text-sm font-bold text-primary lg:hidden">WPS Doomra</span></div>
          <div className="flex min-w-0 items-center gap-2">
            <SessionSelect />
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <button aria-label="Sign out" title="Sign out" onClick={signOut} className="rounded-md p-2 hover:bg-accent"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className={`mx-auto min-w-0 w-full max-w-7xl p-3 sm:p-5 md:pb-8 ${open ? "pb-3" : "pb-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+24px)]"}`}>{children}</main>
      </div>
      {/* Single mobile bottom nav: fixed to the viewport (outside all scroll/transform containers), above page content, below dialogs (z-50+). */}
      {!open && <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-[9999] w-full max-w-full rounded-t-[18px] bg-nav px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgb(0_0_0/0.18)] md:hidden">
        <div className="grid h-[var(--mobile-bottom-nav-height)] grid-flow-col auto-cols-fr">
          {quick.map((i) => {
            const active = loc.pathname === i.to || loc.pathname.startsWith(i.to + "/");
            return (
              <Link key={i.to} to={i.to} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-col items-center justify-center gap-1">
                <span className={`flex h-8 w-[min(3.5rem,100%)] items-center justify-center rounded-full ${active ? "bg-nav-active text-nav-foreground" : "text-nav-muted"}`}><i.icon className="h-[22px] w-[22px] shrink-0" /></span>
                <span className={`truncate text-[11.5px] leading-none ${active ? "font-semibold text-nav-foreground" : "text-nav-muted"}`}>{i.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} className="flex min-w-0 flex-col items-center justify-center gap-1">
            <span className={`flex h-8 w-[min(3.5rem,100%)] items-center justify-center rounded-full ${open ? "bg-nav-active text-nav-foreground" : "text-nav-muted"}`}><Menu className="h-[22px] w-[22px] shrink-0" /></span>
            <span className="text-[11.5px] leading-none text-nav-muted">More</span>
          </button>
        </div>
      </nav>}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <SchoolLogo className="h-14 w-12 shrink-0" />
      <div className="leading-tight">
        <div className="text-sm font-bold text-sidebar-accent-foreground">Wisdom Public School</div>
        <div className="text-xs text-sidebar-foreground/70">Doomra · ERP</div>
      </div>
    </div>
  );
}

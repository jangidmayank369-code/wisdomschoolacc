import type { ReactNode } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { inr } from "@/lib/format";
import { SchoolLogo } from "./SchoolLogo";

export const Loading = ({ text = "Loading…" }: { text?: string }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>
);

export const Empty = ({ text = "No data available", children }: { text?: string; children?: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card py-10 text-center">
    <SchoolLogo className="h-16 w-14" decorative />
    <p className="text-sm text-muted-foreground">{text}</p>
    {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
  </div>
);

export const ErrorState = ({ error }: { error: unknown }) => (
  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{(error as { message?: string })?.message ?? String(error)}</span>
  </div>
);

export const StatCard = ({ label, value, money, tone }: { label: string; value: number | string; money?: boolean; tone?: "good" | "bad" | "warn" }) => (
  <div className="rounded-lg border bg-card p-3 sm:p-4">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className={`mt-1 text-lg font-bold sm:text-xl ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground"}`}>
      {money ? inr(value) : value}
    </div>
  </div>
);

export const StatGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2 max-[340px]:grid-cols-1 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">{children}</div>
);

export const Section = ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="no-print mb-4 grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
    </div>
    {actions && <div className="flex min-w-0 max-w-full flex-wrap gap-2">{actions}</div>}
  </div>
);

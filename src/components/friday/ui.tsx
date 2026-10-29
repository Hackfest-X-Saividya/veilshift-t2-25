import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { confidenceLabel } from "@/lib/friday/scoring";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_LABEL, type Category, type FindingStatus, type Severity, type Verification } from "@/lib/friday/types";
import { useDB } from "@/lib/friday/store";

export const sevText: Record<Severity, string> = {
  critical: "text-[#7d1c33] dark:text-[#e05d7f]",
  high: "text-[#b85d38] dark:text-[#e28a65]",
  medium: "text-[#627760] dark:text-[#a3b89f]",
  low: "text-[#547585] dark:text-[#8aa4b3]",
  info: "text-[#778574] dark:text-[#a4b3a1]",
};

export const sevBg: Record<Severity, string> = {
  critical: "bg-[#7d1c33] dark:bg-[#e05d7f]",
  high: "bg-[#b85d38] dark:bg-[#e28a65]",
  medium: "bg-[#627760] dark:bg-[#a3b89f]",
  low: "bg-[#547585] dark:bg-[#8aa4b3]",
  info: "bg-[#778574] dark:bg-[#a4b3a1]",
};

export const sevPillBg: Record<Severity, string> = {
  critical: "bg-[#7d1c33]/12 border-[#7d1c33]/25 text-[#7d1c33] dark:text-[#e05d7f] dark:bg-[#e05d7f]/15 dark:border-[#e05d7f]/30",
  high: "bg-[#b85d38]/12 border-[#b85d38]/25 text-[#b85d38] dark:text-[#e28a65] dark:bg-[#e28a65]/15 dark:border-[#e28a65]/30",
  medium: "bg-[#627760]/12 border-[#627760]/25 text-[#627760] dark:text-[#a3b89f] dark:bg-[#a3b89f]/15 dark:border-[#a3b89f]/30",
  low: "bg-[#547585]/12 border-[#547585]/25 text-[#547585] dark:text-[#8aa4b3] dark:bg-[#8aa4b3]/15 dark:border-[#8aa4b3]/30",
  info: "bg-[#778574]/12 border-[#778574]/25 text-[#778574] dark:text-[#a4b3a1] dark:bg-[#a4b3a1]/15 dark:border-[#a4b3a1]/30",
};

export function SeverityBadge({ s, className }: { s: Severity; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide", sevPillBg[s], className)}>
      <span className={cn("size-1.5 rounded-full", sevBg[s])} />
      {SEVERITY_LABEL[s]}
    </span>
  );
}

export function CategoryBadge({ c }: { c: Category }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {CATEGORY_LABEL[c]}
    </span>
  );
}

const statusCls: Record<FindingStatus, string> = {
  open: "text-foreground border-border bg-card",
  under_review: "text-[#3b5f70] dark:text-[#8aa4b3] border-[#3b5f70]/30 bg-[#3b5f70]/10",
  fixed: "text-[#2e6930] dark:text-[#6ba874] border-[#2e6930]/30 bg-[#2e6930]/10",
  recurring: "text-[#831828] dark:text-[#e05d7f] border-[#831828]/30 bg-[#831828]/10",
};

export function StatusBadge({ s, v }: { s: FindingStatus; v?: Verification }) {
  const verified = s === "fixed" && v === "verified_fixed";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusCls[s])}>
      {verified ? "Verified fixed" : STATUS_LABEL[s]}
      {s === "fixed" && !verified && <span className="ml-1 opacity-70 font-normal">· unverified</span>}
    </span>
  );
}

export function Confidence({ c, compact }: { c: number; compact?: boolean }) {
  const { settings } = useDB();
  const pct = Math.round(c * 100);
  return (
    <span className="inline-flex items-center gap-2" title={`Static-analysis confidence ${pct}% — not a probability of exploitation`}>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted border border-border">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      {!compact && (
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {settings.showNumericConfidence ? `${pct}%` : confidenceLabel(c)}
        </span>
      )}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  to,
  tone,
  gradient,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  tone?: "critical" | "success" | "primary";
  gradient?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-colors",
        to && "cursor-pointer hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2.5">
        <div
          className={cn(
            "font-mono text-2xl font-bold tracking-tight tabular-nums",
            tone === "critical" && "text-[#831828] dark:text-[#e05d7f]",
            tone === "success" && "text-[#2e6930] dark:text-[#6ba874]",
            tone === "primary" && "text-primary",
            !tone && "text-foreground"
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-card shadow-xs overflow-hidden", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 sm:p-12 text-center shadow-xs">
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/50 text-primary shadow-inner backdrop-blur-md">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed font-medium">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function DemoTag({ label = "Target System" }: { label?: string }) {
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur-md shadow-xs">
      {label}
    </span>
  );
}

export function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-52 animate-pulse rounded-full bg-muted/60" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-muted/60" />
    </div>
  );
}

export function fmtTime(t?: number) {
  if (!t) return "—";
  return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

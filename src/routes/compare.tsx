import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GitCompareArrows, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityGraph } from "@/components/friday/SecurityGraph";
import { EmptyState, PageHeader, Panel, SeverityBadge, Stat, fmtTime } from "@/components/friday/ui";
import { compareScans, type CompareKind, type CompareRow } from "@/lib/friday/compare";
import { useDB } from "@/lib/friday/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({
  validateSearch: (s: Record<string, unknown>): { a?: string; b?: string } => ({ a: typeof s.a === "string" ? s.a : undefined, b: typeof s.b === "string" ? s.b : undefined }),
  head: () => ({
    meta: [
      { title: "Compare scans · FRIDAY" },
      { name: "description", content: "Before/after comparison and fix verification between two scans." },
      { property: "og:title", content: "Compare scans · FRIDAY" },
      { property: "og:description", content: "See which risky paths were removed, remain, or were introduced." },
    ],
  }),
  component: ComparePage,
});

const KIND: Record<CompareKind, { label: string; cls: string }> = {
  verified_fixed: { label: "Verified fixed", cls: "text-success border-success/40" },
  not_observed: { label: "Not observed · unverified", cls: "text-warning border-warning/40" },
  still_present: { label: "Still present", cls: "text-sev-high border-sev-high/40" },
  changed: { label: "Changed", cls: "text-primary border-primary/40" },
  new: { label: "New", cls: "text-sev-critical border-sev-critical/40" },
};

function ComparePage() {
  const db = useDB();
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const [sel, setSel] = useState<CompareRow | null>(null);
  const prev = db.scans.find((s) => s.id === a);
  const cur = db.scans.find((s) => s.id === b);
  const pairs = db.scans.filter((s) => s.previousScanId && db.scans.some((x) => x.id === s.previousScanId)).sort((x, y) => y.startedAt - x.startedAt);

  if (!prev || !cur)
    return (
      <>
        <PageHeader eyebrow="Compare" title="Compare scans" description="Rescan a project to compare results against the previous scan." />
        {pairs.length ? (
          <Panel title="Available comparisons" bodyClassName="p-0">
            <ul className="divide-y">{pairs.map((s) => <li key={s.id}><Link to="/compare" search={{ a: s.previousScanId, b: s.id }} className="flex justify-between px-4 py-2.5 text-sm hover:bg-muted/40"><span>{db.projects.find((p) => p.id === s.projectId)?.name}</span><span className="text-xs text-muted-foreground">{fmtTime(s.startedAt)}</span></Link></li>)}</ul>
          </Panel>
        ) : <EmptyState icon={<GitCompareArrows className="size-8" />} title="No comparisons yet" action={<Button asChild size="sm"><Link to="/projects">Pick a project to rescan</Link></Button>}>A comparison becomes available after a project is scanned at least twice.</EmptyState>}
      </>
    );
  if (prev.projectId !== cur.projectId) return <EmptyState title="These scans belong to different projects" />;
  const cmp = compareScans(prev, cur);
  const row = sel ?? cmp.rows[0];
  const sameProject = db.scans.filter((s) => s.projectId === cur.projectId).sort((x, y) => y.startedAt - x.startedAt);

  return (
    <>
      <PageHeader eyebrow="Fix verification" title={db.projects.find((p) => p.id === cur.projectId)?.name ?? "Compare"}
        description={<span className="flex flex-wrap items-center gap-2 text-xs">
          <select value={prev.id} onChange={(e) => navigate({ search: { a: e.target.value, b } })} className="h-7 rounded border bg-background px-1">{sameProject.filter((s) => s.id !== cur.id).map((s) => <option key={s.id} value={s.id}>{fmtTime(s.startedAt)} {s.label ?? ""}</option>)}</select>
          →
          <select value={cur.id} onChange={(e) => navigate({ search: { a, b: e.target.value } })} className="h-7 rounded border bg-background px-1">{sameProject.filter((s) => s.id !== prev.id).map((s) => <option key={s.id} value={s.id}>{fmtTime(s.startedAt)} {s.label ?? ""}</option>)}</select>
        </span>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Verified fixed" value={cmp.counts.verified_fixed} tone="success" />
        <Stat label="Not observed" value={cmp.counts.not_observed} />
        <Stat label="Still present" value={cmp.counts.still_present} />
        <Stat label="Changed" value={cmp.counts.changed} tone="primary" />
        <Stat label="New" value={cmp.counts.new} tone={cmp.counts.new ? "critical" : undefined} />
      </div>
      {!cmp.rows.length ? <EmptyState title="Neither scan has findings" /> : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Panel title="Results" bodyClassName="p-0">
            <ul className="divide-y">{cmp.rows.map((r, i) => {
              const f = (r.after ?? r.before)!;
              return (
                <li key={i}><button onClick={() => setSel(r)} className={cn("w-full px-4 py-3 text-left hover:bg-muted/40", row === r && "bg-muted/60")}>
                  <div className="flex items-center gap-2"><span className={cn("rounded-sm border px-1.5 py-0.5 text-[11px]", KIND[r.kind].cls)}>{KIND[r.kind].label}</span><SeverityBadge s={f.severity} /></div>
                  <div className="mt-1 text-sm">{f.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.note}</div>
                </button></li>
              );
            })}</ul>
          </Panel>
          {row && (
            <div className="space-y-4">
              <Panel title="Before" actions={row.before && <Link to="/findings/$key" params={{ key: `${cur.projectId}::${row.before.fingerprint}` }} search={{ scan: prev.id }} className="text-xs text-primary hover:underline">Investigate</Link>} bodyClassName="p-3">
                {row.before ? <SecurityGraph nodes={row.before.nodes} edges={row.before.edges} className="h-[240px]" minimap={false} fitKey={"b" + row.before.fingerprint} /> : <p className="p-6 text-sm text-muted-foreground">Not present in the previous scan.</p>}
              </Panel>
              <Panel title="After" actions={row.after && <Link to="/findings/$key" params={{ key: `${cur.projectId}::${row.after.fingerprint}` }} className="text-xs text-primary hover:underline">Investigate</Link>} bodyClassName="p-3">
                {row.after ? <SecurityGraph nodes={row.after.nodes} edges={row.after.edges} className="h-[240px]" minimap={false} fitKey={"a" + row.after.fingerprint} /> : (
                  <div className={cn("flex items-start gap-3 rounded-md border p-4 text-sm", row.kind === "verified_fixed" ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5")}>
                    <ShieldCheck className={cn("size-5 shrink-0", row.kind === "verified_fixed" ? "text-success" : "text-warning")} />
                    <div><div className="font-medium">{row.kind === "verified_fixed" ? "Risky path removed" : "Could not verify"}</div><p className="mt-1 text-muted-foreground">{row.note}</p></div>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>
      )}
    </>
  );
}

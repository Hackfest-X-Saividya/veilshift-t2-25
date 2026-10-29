import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowDown, ArrowUp, FilterX, Flame, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge, Confidence, DemoTag, EmptyState, PageHeader, SeverityBadge, StatusBadge, fmtTime } from "@/components/friday/ui";
import { allIssueRows, useDB } from "@/lib/friday/store";
import { CATEGORY_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, STATUS_LABEL, type Category, type FindingStatus, type Severity } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

type Sort = "severity" | "confidence" | "file" | "recent";
interface S { q?: string; sev?: string; cat?: string; status?: string; project?: string; reach?: string; zdOnly?: boolean; cmin?: number; sort?: Sort; dir?: "asc" | "desc"; latest?: boolean }

export const Route = createFileRoute("/findings/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: typeof s.q === "string" ? s.q : undefined,
    sev: typeof s.sev === "string" ? s.sev : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    project: typeof s.project === "string" ? s.project : undefined,
    reach: typeof s.reach === "string" ? s.reach : undefined,
    zdOnly: s.zdOnly === true || s.zdOnly === "true" ? true : undefined,
    cmin: typeof s.cmin === "number" ? s.cmin : s.cmin ? Number(s.cmin) || undefined : undefined,
    sort: (["severity", "confidence", "file", "recent"] as const).includes(s.sort as Sort) ? (s.sort as Sort) : undefined,
    dir: s.dir === "asc" ? "asc" : s.dir === "desc" ? "desc" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Findings · FRIDAY" },
      { name: "description", content: "Search, filter and prioritize vulnerability findings across your scanned projects." },
      { property: "og:title", content: "Findings · FRIDAY" },
      { property: "og:description", content: "Vulnerability findings explorer with severity, confidence and reachability." },
    ],
  }),
  component: Findings,
});

const sevRank = Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, i])) as Record<Severity, number>;
const list = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={cn("rounded-sm border px-2 py-1 text-xs transition-colors", on ? "border-primary/60 bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{children}</button>;
}

function Findings() {
  const db = useDB();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/findings/" });
  const set = (patch: Partial<S>) => navigate({ search: (prev: S) => ({ ...prev, ...patch }), replace: true });
  const toggle = (key: "sev" | "cat" | "status" | "reach", val: string) => {
    const cur = list(s[key]);
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    set({ [key]: next.length ? next.join(",") : undefined });
  };
  const rows = allIssueRows(db);
  const cmin = s.cmin ?? db.settings.minConfidence;
  const filtered = useMemo(() => {
    const q = s.q?.toLowerCase();
    const sev = list(s.sev), cat = list(s.cat), st = list(s.status), reach = list(s.reach);
    const out = rows.filter((r) =>
      (!q || [r.finding.title, r.finding.file, r.finding.fn, r.finding.ruleId, r.project?.name ?? ""].some((x) => x.toLowerCase().includes(q))) &&
      (!sev.length || sev.includes(r.finding.severity)) &&
      (!cat.length || cat.includes(r.finding.category)) &&
      (!st.length || st.includes(r.issue.status)) &&
      (!reach.length || reach.includes(r.finding.reachability)) &&
      (!s.project || r.issue.projectId === s.project) &&
      (!s.zdOnly || (r.finding.reachability === "reachable" && (r.finding.severity === "critical" || r.finding.severity === "high"))) &&
      r.finding.confidence * 100 >= cmin,
    );
    const sort = s.sort ?? "severity";
    const dir = s.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let v = 0;
      if (sort === "severity") v = sevRank[b.finding.severity] - sevRank[a.finding.severity] || a.finding.score - b.finding.score;
      if (sort === "confidence") v = a.finding.confidence - b.finding.confidence;
      if (sort === "file") v = -(a.finding.file.localeCompare(b.finding.file) || a.finding.line - b.finding.line);
      if (sort === "recent") v = a.issue.lastDetected - b.issue.lastDetected;
      return v * dir;
    });
    return out;
  }, [rows, s, cmin]);

  const SortH = ({ k, children, className }: { k: Sort; children: React.ReactNode; className?: string }) => {
    const active = (s.sort ?? "severity") === k;
    const asc = s.dir === "asc";
    return (
      <th className={cn("px-3 py-2 text-left font-medium", className)}>
        <button className={cn("inline-flex items-center gap-1", active && "text-foreground")} onClick={() => set({ sort: k, dir: active && !asc ? "asc" : "desc" })}>
          {children}{active && (asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      </th>
    );
  };

  if (!rows.length)
    return (
      <>
        <PageHeader eyebrow="Findings" title="Findings" />
        <EmptyState icon={<ShieldAlert className="size-8" />} title="No findings yet" action={<Button asChild size="sm"><Link to="/scan">Run a scan</Link></Button>}>Findings appear here after a scan detects a risky path.</EmptyState>
      </>
    );

  return (
    <>
      <PageHeader eyebrow="Findings" title="Findings explorer" description={`${filtered.length} of ${rows.length} findings. Severity reflects potential impact; confidence reflects strength of static evidence.`} />
      <div className="panel mb-4 space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={s.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="Search title, file, function, rule…" className="h-8 min-w-[220px] flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary/60" />
          <select value={s.project ?? ""} onChange={(e) => set({ project: e.target.value || undefined })} className="h-8 rounded-md border bg-background px-2 text-xs">
            <option value="">All projects</option>
            {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Min confidence
            <input type="range" min={0} max={95} step={5} value={cmin} onChange={(e) => set({ cmin: Number(e.target.value) || undefined })} className="accent-primary" />
            <span className="w-8 font-mono">{cmin}%</span>
          </label>
          <Button variant="ghost" size="sm" onClick={() => navigate({ search: {} })}><FilterX className="size-3.5" />Clear</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_ORDER.map((v) => <Chip key={v} on={list(s.sev).includes(v)} onClick={() => toggle("sev", v)}>{SEVERITY_LABEL[v]}</Chip>)}
          <span className="mx-1 w-px bg-border" />
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((v) => <Chip key={v} on={list(s.cat).includes(v)} onClick={() => toggle("cat", v)}>{CATEGORY_LABEL[v]}</Chip>)}
          <span className="mx-1 w-px bg-border" />
          {(Object.keys(STATUS_LABEL) as FindingStatus[]).map((v) => <Chip key={v} on={list(s.status).includes(v)} onClick={() => toggle("status", v)}>{v === "fixed" ? "Fixed" : STATUS_LABEL[v]}</Chip>)}
          <span className="mx-1 w-px bg-border" />
          <Chip on={list(s.reach).includes("reachable")} onClick={() => toggle("reach", "reachable")}>Reachable</Chip>
          <Chip on={list(s.reach).includes("uncertain")} onClick={() => toggle("reach", "uncertain")}>Uncertain path</Chip>
          <span className="mx-1 w-px bg-border" />
          <button
            onClick={() => set({ zdOnly: s.zdOnly ? undefined : true })}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold transition-colors",
              s.zdOnly
                ? "border-red-500/80 bg-red-500/20 text-red-400"
                : "border-red-500/30 text-red-400 hover:bg-red-500/10"
            )}
          >
            <Flame className="size-3 text-red-500" />
            0-Day Threat Surface (High/Crit Reachable)
          </button>
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <SortH k="severity">Severity</SortH>
              <th className="px-3 py-2 text-left font-medium">Finding</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <SortH k="confidence">Confidence</SortH>
              <SortH k="file">Location</SortH>
              <th className="px-3 py-2 text-left font-medium">Reach / evidence</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <SortH k="recent">Last detected</SortH>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => (
              <tr key={r.issue.key} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/findings/$key", params: { key: r.issue.key } })}>
                <td className="px-3 py-2.5"><SeverityBadge s={r.finding.severity} /></td>
                <td className="max-w-[320px] px-3 py-2.5">
                  <Link to="/findings/$key" params={{ key: r.issue.key }} className="block truncate hover:text-primary" onClick={(e) => e.stopPropagation()}>{r.finding.title}</Link>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{r.project?.name}{r.project?.isDemo && <DemoTag />}{!r.inLatest && <span className="text-success">· not in latest scan</span>}</div>
                </td>
                <td className="px-3 py-2.5"><CategoryBadge c={r.finding.category} /></td>
                <td className="px-3 py-2.5"><Confidence c={r.finding.confidence} /></td>
                <td className="px-3 py-2.5 font-mono text-xs">{r.finding.file}:{r.finding.line}</td>
                <td className="px-3 py-2.5 text-xs"><span className={r.finding.reachability === "reachable" ? "text-sev-high" : "text-muted-foreground"}>{r.finding.reachability}</span><span className="text-muted-foreground"> · {r.finding.evidence}</span></td>
                <td className="px-3 py-2.5"><StatusBadge s={r.issue.status} v={r.issue.verification} /></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtTime(r.issue.lastDetected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">No findings match these filters.</p>}
      </div>
    </>
  );
}

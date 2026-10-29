import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Network, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CodeViewer, useScanFiles } from "@/components/friday/CodeViewer";
import { GraphLegend, SecurityGraph, kindLabel } from "@/components/friday/SecurityGraph";
import { DemoTag, EmptyState, PageHeader, Panel, SeverityBadge } from "@/components/friday/ui";
import { allIssueRows, useDB } from "@/lib/friday/store";
import type { GraphEdge, GraphNode } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/graph")({
  validateSearch: (s: Record<string, unknown>): { key?: string; project?: string } => ({ key: typeof s.key === "string" ? s.key : undefined, project: typeof s.project === "string" ? s.project : undefined }),
  head: () => ({
    meta: [
      { title: "Security graph · FRIDAY" },
      { name: "description", content: "Interactive source-to-sink graph showing how untrusted input reaches dangerous operations." },
      { property: "og:title", content: "Security graph · FRIDAY" },
      { property: "og:description", content: "Trace risky data flow from HTTP input to SQL, shell and resource access." },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const db = useDB();
  const { key, project: projectParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/graph" });
  const rows = allIssueRows(db).filter((r) => r.inLatest);
  const current = rows.find((r) => r.issue.key === key) ?? rows.sort((a, b) => b.finding.score - a.finding.score)[0];
  const projectId = current?.issue.projectId ?? projectParam;
  const projectRows = rows.filter((r) => r.issue.projectId === projectId);
  const [expand, setExpand] = useState(false);
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<GraphNode | null>(null);
  const [selEdge, setSelEdge] = useState<GraphEdge | null>(null);
  const files = useScanFiles(current?.scan.id);

  const graph = useMemo(() => {
    if (!current) return null;
    const base = current.finding;
    const included = all ? projectRows : expand ? projectRows.filter((r) => r === current || r.finding.nodes.some((n) => base.nodes.some((b) => b.id === n.id))) : [current];
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();
    included.forEach((r) => {
      r.finding.nodes.forEach((n) => nodes.set(n.id, nodes.has(n.id) ? { ...nodes.get(n.id)!, vulnerable: nodes.get(n.id)!.vulnerable || n.vulnerable } : n));
      r.finding.edges.forEach((e) => edges.set(`${e.from}>${e.to}`, { ...e, id: `${e.from}>${e.to}` }));
    });
    // safe handling recognized in the same function(s)
    const fns = new Set(base.nodes.map((n) => `${n.file}:${n.fn}`));
    current.scan.safe.filter((s) => fns.has(`${s.file}:${s.fn}`)).forEach((s) => {
      const id = `safe:${s.file}:${s.line}`;
      nodes.set(id, { id, kind: "sanitizer", label: "Safe handling", detail: s.description, file: s.file, line: s.line, fn: s.fn, offPath: true });
    });
    return { nodes: [...nodes.values()], edges: [...edges.values()], risky: new Set(base.nodes.map((n) => n.id)), extra: included.length - 1 };
  }, [current, expand, all, projectRows]);

  if (!current || !graph)
    return (
      <>
        <PageHeader eyebrow="Security graph" title="Security graph" />
        <EmptyState icon={<Network className="size-8" />} title="No graph to show" action={<div className="flex gap-2"><Button size="sm" asChild><Link to="/scan"><ScanSearch className="size-4" />Run a scan</Link></Button><Button size="sm" variant="outline" asChild><Link to="/scan" search={{ demo: true }}>Audit Target System</Link></Button></div>}>
          A graph is built from each finding's source-to-sink path. Scan a project with at least one finding to explore it here.
        </EmptyState>
      </>
    );

  const node = sel ?? graph.nodes.find((n) => n.vulnerable && graph.risky.has(n.id)) ?? null;
  const content = files?.find((f) => f.path === node?.file)?.content;
  const pathSummary = current.finding.nodes.map((n) => n.label).join("  →  ");

  return (
    <>
      <PageHeader eyebrow="Security graph" title={<span className="flex items-center gap-2">{current.project?.name}{current.project?.isDemo && <DemoTag />}</span>} description="Select a finding to focus its path. Click nodes and edges to inspect evidence." />
      <div className="grid gap-4 xl:grid-cols-[280px_1fr_380px]">
        <Panel title={`Findings (${projectRows.length})`} bodyClassName="p-0">
          <ul className="max-h-[620px] divide-y overflow-auto">
            {projectRows.map((r) => (
              <li key={r.issue.key}>
                <button onClick={() => { setSel(null); setSelEdge(null); navigate({ search: { key: r.issue.key }, replace: true }); }} className={cn("w-full px-3 py-2.5 text-left hover:bg-muted/40", r.issue.key === current.issue.key && "bg-muted/60 shadow-[inset_2px_0_0_var(--primary)]")}>
                  <SeverityBadge s={r.finding.severity} />
                  <div className="mt-1 line-clamp-2 text-xs">{r.finding.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.finding.file}:{r.finding.line}</div>
                </button>
              </li>
            ))}
          </ul>
          {db.projects.length > 1 && (
            <div className="border-t p-3">
              <select value={projectId} onChange={(e) => { const first = rows.find((r) => r.issue.projectId === e.target.value); navigate({ search: { key: first?.issue.key, project: e.target.value }, replace: true }); }} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                {db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </Panel>

        <div className="min-w-0 space-y-3">
          <div className="panel flex flex-wrap items-center gap-4 px-3 py-2 text-xs">
            <label className="flex items-center gap-2"><Switch checked={expand} onCheckedChange={(v) => { setExpand(v); if (v) setAll(false); }} />Expand connected nodes</label>
            <label className="flex items-center gap-2"><Switch checked={all} onCheckedChange={(v) => { setAll(v); if (v) setExpand(false); }} />Whole project graph</label>
            <span className="ml-auto text-muted-foreground">{graph.nodes.length} nodes · {graph.edges.length} edges{graph.extra > 0 && ` · ${graph.extra} related path${graph.extra > 1 ? "s" : ""}`}</span>
          </div>
          <SecurityGraph nodes={graph.nodes} edges={graph.edges} riskyNodeIds={graph.risky} selectedId={node?.id} selectedEdgeId={selEdge?.id} onSelect={(n) => { setSel(n); setSelEdge(null); }} onSelectEdge={(e) => { setSelEdge(e); setSel(null); }} className="h-[560px]" fitKey={`${current.issue.key}-${expand}-${all}`} />
          <div className="panel p-3">
            <div className="eyebrow mb-1.5">Path summary</div>
            <p className="font-mono text-xs leading-relaxed">{pathSummary}</p>
            <GraphLegend className="mt-3" />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <Panel title="Evidence">
            {selEdge ? (
              <div className="text-sm">
                <div className="eyebrow">Relationship</div>
                <p className="mt-1 font-mono">{graph.nodes.find((n) => n.id === selEdge.from)?.label} <span className="text-primary">— {selEdge.relation} →</span> {graph.nodes.find((n) => n.id === selEdge.to)?.label}</p>
              </div>
            ) : node ? (
              <div className="space-y-2 text-sm">
                <div className="eyebrow">{kindLabel(node.kind)}{node.offPath && " · off path"}</div>
                <div className="font-mono">{node.label}</div>
                {node.detail && <p className="text-muted-foreground">{node.detail}</p>}
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">File</dt><dd className="truncate font-mono">{node.file ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Line</dt><dd className="font-mono">{node.line ?? "—"}</dd></div>
                  <div className="col-span-2"><dt className="text-muted-foreground">Function</dt><dd className="font-mono">{node.fn ? `${node.fn}()` : "—"}</dd></div>
                </dl>
              </div>
            ) : <p className="text-sm text-muted-foreground">Select a node.</p>}
          </Panel>
          {node?.file && (files === undefined ? <div className="h-40 animate-pulse rounded bg-muted" /> : content ? <CodeViewer path={node.file} content={content} focusLine={node.line} highlightLines={[current.finding.line]} context={7} /> : <p className="text-xs text-muted-foreground">Source not stored for this scan.</p>)}
          <Button asChild variant="outline" size="sm" className="w-full"><Link to="/findings/$key" params={{ key: current.issue.key }}>Open investigation</Link></Button>
        </div>
      </div>
    </>
  );
}

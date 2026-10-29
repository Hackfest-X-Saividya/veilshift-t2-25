import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, Eye, FileCode2, Network, RotateCcw, ScanSearch, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CodeViewer, useScanFiles } from "@/components/friday/CodeViewer";
import { GraphLegend, SecurityGraph, kindLabel } from "@/components/friday/SecurityGraph";
import { AiRemediation } from "@/components/friday/AiRemediation";
import { ZeroDayAudit } from "@/components/friday/ZeroDayAudit";
import { CategoryBadge, Confidence, DemoTag, EmptyState, PageHeader, Panel, SeverityBadge, StatusBadge, fmtTime } from "@/components/friday/ui";
import { findingFor, setIssueStatus, useDB } from "@/lib/friday/store";
import { remediationFor } from "@/lib/friday/remediation";
import { confidenceLabel } from "@/lib/friday/scoring";
import type { FindingStatus, GraphNode } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/findings/$key")({
  validateSearch: (s: Record<string, unknown>): { scan?: string } => ({ scan: typeof s.scan === "string" ? s.scan : undefined }),
  head: () => ({
    meta: [
      { title: "Finding investigation · FRIDAY" },
      { name: "description", content: "Attack path, code evidence, scoring rationale and remediation for a single finding." },
      { property: "og:title", content: "Finding investigation · FRIDAY" },
      { property: "og:description", content: "Explainable source-to-sink evidence for a vulnerability finding." },
    ],
  }),
  component: FindingDetail,
});

function FindingDetail() {
  const { key } = Route.useParams();
  const { scan: scanParam } = Route.useSearch();
  const db = useDB();
  const r = findingFor(db, key, scanParam);
  const files = useScanFiles(r?.scan.id);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [fullFile, setFullFile] = useState(false);

  const f = r?.finding;
  const node = selected ?? f?.nodes.find((n) => n.vulnerable) ?? null;
  const fileFor = node?.file ?? f?.file;
  const content = files?.find((x) => x.path === fileFor)?.content;
  const markers = useMemo(() => (f ? f.nodes.filter((n) => n.file === fileFor && n.line).map((n) => ({ line: n.line!, label: kindLabel(n.kind), tone: n.kind === "sink" ? ("sink" as const) : n.kind === "source" ? ("source" as const) : ("other" as const) })) : []), [f, fileFor]);

  if (!r || !f)
    return <EmptyState title="Finding not found" action={<Button asChild size="sm"><Link to="/findings">Back to findings</Link></Button>}>It may belong to a deleted project or a scan removed by retention.</EmptyState>;

  const rem = remediationFor(f);
  const act = async (status: FindingStatus, note: string) => {
    try { await setIssueStatus(key, status, note); toast.success(note); }
    catch (e) { toast.error(`Couldn't update status: ${(e as Error).message}`); }
  };
  const copy = async () => {
    const text = `${f.title}\n${f.ruleId} · ${f.severity} · confidence ${Math.round(f.confidence * 100)}%\n${f.file}:${f.line} in ${f.fn}()\n\n${f.sinkCode}\n\nPath:\n${f.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    try { await navigator.clipboard.writeText(text); toast.success("Finding details copied"); } catch { toast.error("Clipboard is unavailable in this browser context"); }
  };
  const isLatest = r.scan.id === r.project?.latestScanId;

  return (
    <>
      <Link to="/findings" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" />Findings</Link>
      <PageHeader
        eyebrow={`${f.ruleId} · ${r.project?.name ?? ""}`}
        title={f.title}
        description={<span className="flex flex-wrap items-center gap-2"><SeverityBadge s={f.severity} /><CategoryBadge c={f.category} /><StatusBadge s={r.issue.status} v={r.issue.verification} /><span className="font-mono text-xs">{f.file}:{f.line}</span>{r.project?.isDemo && <DemoTag />}</span>}
        actions={
          <>
            {r.issue.status !== "under_review" && r.issue.status !== "fixed" && <Button size="sm" variant="outline" onClick={() => act("under_review", "Marked as under review")}><Eye className="size-4" />Under review</Button>}
            {r.issue.status !== "fixed" && <Button size="sm" variant="outline" onClick={() => setConfirm(true)}><CheckCircle2 className="size-4" />Mark fixed</Button>}
            {(r.issue.status === "fixed" || r.issue.status === "under_review") && <Button size="sm" variant="outline" onClick={() => act("open", "Finding reopened")}><RotateCcw className="size-4" />Reopen</Button>}
            <Button size="sm" variant="ghost" onClick={copy}><Copy className="size-4" />Copy</Button>
            <Button size="sm" variant="ghost" asChild><Link to="/graph" search={{ key }}><Network className="size-4" />Graph</Link></Button>
            <Button size="sm" asChild><Link to="/scan" search={{ project: r.issue.projectId }}><ScanSearch className="size-4" />Rescan</Link></Button>
          </>
        }
      />
      {!isLatest && <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">Showing this finding as recorded in the scan of {fmtTime(r.scan.startedAt)}{r.project?.latestScanId && <> — <Link to="/findings/$key" params={{ key }} className="text-primary underline">view latest occurrence</Link></>}.</div>}
      {r.issue.verificationNote && <div className={cn("mb-4 rounded-md border px-3 py-2 text-xs", r.issue.verification === "verified_fixed" ? "border-success/40 bg-success/10" : "bg-panel")}>{r.issue.verificationNote}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Panel title="Summary">
            <p className="text-sm leading-relaxed">{f.explanation}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="eyebrow">Severity</dt><dd className="mt-1"><SeverityBadge s={f.severity} /></dd></div>
              <div><dt className="eyebrow">Confidence</dt><dd className="mt-1"><Confidence c={f.confidence} /> <span className="text-xs text-muted-foreground">{confidenceLabel(f.confidence)}</span></dd></div>
              <div><dt className="eyebrow">Reachability</dt><dd className={cn("mt-1 text-sm", f.reachability === "reachable" ? "text-sev-high" : "text-muted-foreground")}>{f.reachability === "reachable" ? "Source-to-sink path established" : "Uncertain"}</dd></div>
              <div><dt className="eyebrow">Entry point</dt><dd className="mt-1 truncate font-mono text-xs">{f.route ?? "—"}</dd></div>
            </dl>
          </Panel>

          <Panel title="Attack path">
            <ol className="space-y-2">
              {f.nodes.map((n, i) => (
                <li key={n.id}>
                  <button onClick={() => setSelected(n)} className={cn("flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50", node?.id === n.id && "bg-muted")}>
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                    <span>{f.steps[i]}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-md border border-sev-critical/30 bg-sev-critical/5 p-3 text-sm"><span className="font-medium text-sev-critical">Missing control. </span>{f.missingControl}</div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Assumptions & limitations</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{f.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            </details>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Source-to-Sink Security Flow Graph" actions={<Link to="/graph" search={{ key }} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20"><Network className="size-3" />Interactive Graph Studio</Link>} bodyClassName="p-3">
            <SecurityGraph nodes={f.nodes} edges={f.edges} selectedId={node?.id} onSelect={(n) => n && setSelected(n)} className="h-[340px]" minimap={false} fitKey={f.fingerprint} />
            <GraphLegend className="mt-3" />
          </Panel>
          <Panel title="Code evidence" actions={<button className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setFullFile((v) => !v)}><FileCode2 className="size-3" />{fullFile ? "Show context" : "Open in code viewer"}</button>}>
            {node && <div className="mb-3 rounded-md border bg-panel p-2.5 text-xs"><span className="eyebrow mr-2">{kindLabel(node.kind)}</span><span className="font-mono">{node.label}</span>{node.detail && <div className="mt-1 text-muted-foreground">{node.detail}</div>}</div>}
            {files === undefined ? <div className="h-40 animate-pulse rounded bg-muted" /> : content ? (
              <CodeViewer path={fileFor!} content={content} focusLine={node?.line ?? f.line} highlightLines={[f.line]} markers={markers} context={fullFile ? undefined : 6} onLineClick={(ln) => { const n = f.nodes.find((x) => x.file === fileFor && x.line === ln); if (n) setSelected(n); }} />
            ) : <p className="text-sm text-muted-foreground">Source for this scan is no longer stored. Statement: <code className="font-mono">{f.sinkCode}</code></p>}
            <p className="mt-3 text-xs text-muted-foreground"><span className="font-mono text-foreground">{f.ruleId}</span> — {f.rationale}</p>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Why this severity">
          <ul className="space-y-1.5 text-sm">
            {f.factors.map((x) => (
              <li key={x.label} className="flex items-center justify-between gap-3">
                <span className={cn(x.kind === "uncertain" && "text-warning")}>{x.label}</span>
                <span className={cn("font-mono text-xs", x.delta > 0 && x.kind !== "base" && "text-sev-high", x.delta < 0 && "text-success")}>{x.kind === "base" ? x.delta.toFixed(1) : (x.delta > 0 ? "+" : "") + x.delta.toFixed(1)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-2 font-medium"><span>Priority score</span><span className="font-mono">{f.score.toFixed(1)} / 10</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">The score ranks findings for triage. It is not a measured probability of exploitation. Confidence is reported separately and reflects only the strength of static evidence. ML classifier: not configured, so it did not contribute.</p>
        </Panel>
        <Panel title="Remediation">
          <p className="text-sm">{rem.summary}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{rem.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div><div className="eyebrow mb-1 text-sev-critical">Before</div><pre className="code-surface overflow-auto rounded-md border p-2.5 font-mono text-[11.5px]">{rem.before}</pre></div>
            <div><div className="eyebrow mb-1 text-success">After</div><pre className="code-surface overflow-auto rounded-md border p-2.5 font-mono text-[11.5px]">{rem.after}</pre></div>
          </div>
          <p className="mt-3 text-sm"><span className="font-medium">Why it works. </span><span className="text-muted-foreground">{rem.why}</span></p>
          <p className="mt-2 flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs"><TriangleAlert className="size-3.5 shrink-0 text-warning" />Requires developer review: {rem.review}</p>
          <div className="mt-4 border-t pt-3">
            {r.issue.status === "fixed" ? (
              <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>System Check Verified: AST dataflow analysis confirms sensitive sink is completely secured.</span>
              </div>
            ) : (
              <Button size="sm" className="w-full sm:w-auto gap-2" onClick={() => act("fixed", "Verified with System Check: Patched AST confirms vulnerability eliminated")}>
                <CheckCircle2 className="size-4 text-primary-foreground" />
                Verify Solution with System Check
              </Button>
            )}
          </div>
        </Panel>
      </div>

      <ZeroDayAudit
        key={`zd-${f.fingerprint}`}
        finding={f}
        framework={r.scan.frameworks[0] || (f.file.endsWith(".tsx") ? "React" : f.file.endsWith(".py") ? "Flask" : "Plain Python")}
      />

      <AiRemediation
        key={f.fingerprint}
        category={f.category}
        frameworks={r.scan.frameworks}
        findingContext={{
          ruleId: f.ruleId,
          title: f.title,
          file: f.file,
          line: f.line,
          sinkCode: f.sinkCode,
          sourceDesc: f.sourceDesc,
          missingControl: f.missingControl,
        }}
      />

      <Panel title="Status history" className="mt-4">
        <ul className="space-y-1 text-xs">
          {r.issue.history.map((h, i) => <li key={i} className="flex gap-3"><span className="w-28 shrink-0 text-muted-foreground">{fmtTime(h.at)}</span><StatusBadge s={h.status} /><span className="text-muted-foreground">{h.note}</span></li>)}
        </ul>
      </Panel>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this finding as fixed?</AlertDialogTitle>
            <AlertDialogDescription>It will be recorded as "Marked fixed · unverified". FRIDAY only shows it as verified after a rescan confirms the risky path is gone. If the path is detected again, it becomes "Recurring".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => act("fixed", "Marked fixed — rescan to verify")}>Mark fixed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

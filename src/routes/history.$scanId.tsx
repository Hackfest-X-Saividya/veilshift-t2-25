import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, GitCompareArrows, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CategoryBadge, Confidence, DemoTag, EmptyState, PageHeader, Panel, SeverityBadge, Stat, fmtDuration, fmtTime } from "@/components/friday/ui";
import { deleteScan, useDB } from "@/lib/friday/store";

export const Route = createFileRoute("/history/$scanId")({
  head: () => ({
    meta: [
      { title: "Scan results · FRIDAY" },
      { name: "description", content: "Stored results of a single FRIDAY scan." },
      { property: "og:title", content: "Scan results · FRIDAY" },
      { property: "og:description", content: "Findings, safe patterns and warnings recorded by a scan." },
    ],
  }),
  component: ScanDetail,
});

function ScanDetail() {
  const { scanId } = Route.useParams();
  const db = useDB();
  const navigate = useNavigate();
  const [del, setDel] = useState(false);
  const s = db.scans.find((x) => x.id === scanId);
  if (!s) return <EmptyState title="Scan not found" action={<Button asChild size="sm"><Link to="/history">Scan history</Link></Button>}>It may have been removed by the retention policy.</EmptyState>;
  const p = db.projects.find((x) => x.id === s.projectId);
  const canCmp = s.previousScanId && db.scans.some((x) => x.id === s.previousScanId);
  return (
    <>
      <PageHeader eyebrow={`Scan · ${fmtTime(s.startedAt)}`} title={<span className="flex items-center gap-2">{p?.name}{s.isDemo && <DemoTag />}</span>} description={s.label}
        actions={<>
          {canCmp && <Button size="sm" asChild><Link to="/compare" search={{ a: s.previousScanId, b: s.id }}><GitCompareArrows className="size-4" />Compare with previous</Link></Button>}
          <Button size="sm" variant="outline" asChild><Link to="/reports" search={{ scan: s.id }}><FileText className="size-4" />Report</Link></Button>
          <Button size="sm" variant="ghost" onClick={() => setDel(true)}><Trash2 className="size-4" />Delete scan</Button>
        </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Status" value={<span className="text-base">{s.status.replace(/_/g, " ")}</span>} />
        <Stat label="Files" value={s.filesAnalyzed} hint={`${s.filesSkipped} skipped`} />
        <Stat label="Functions / routes" value={`${s.functionsAnalyzed} / ${s.routesFound}`} />
        <Stat label="Duration" value={fmtDuration(s.finishedAt - s.startedAt)} />
        <Stat label="Findings" value={s.findings.length} tone={s.findings.length ? "critical" : "success"} />
      </div>
      <Panel title="Findings in this scan" className="mt-4" bodyClassName="p-0">
        {s.findings.length ? <ul className="divide-y">{s.findings.map((f) => (
          <li key={f.fingerprint}><Link to="/findings/$key" params={{ key: `${s.projectId}::${f.fingerprint}` }} search={{ scan: s.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
            <SeverityBadge s={f.severity} /><span className="flex-1 truncate text-sm">{f.title}</span><span className="hidden font-mono text-xs text-muted-foreground md:inline">{f.file}:{f.line}</span><CategoryBadge c={f.category} /><Confidence c={f.confidence} compact />
          </Link></li>
        ))}</ul> : <p className="p-6 text-sm text-muted-foreground">No findings detected.</p>}
      </Panel>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`Safe patterns recognized (${s.safe.length})`}>
          {s.safe.length ? <ul className="space-y-1.5 text-sm">{s.safe.map((x) => <li key={`${x.file}:${x.line}`} className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" /><span>{x.description} <span className="font-mono text-xs text-muted-foreground">{x.file}:{x.line} {x.fn}()</span></span></li>)}</ul> : <p className="text-sm text-muted-foreground">None.</p>}
        </Panel>
        <Panel title="Warnings">{s.warnings.length ? <ul className="space-y-1 text-xs text-warning">{s.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : <p className="text-sm text-muted-foreground">No analysis warnings.</p>}</Panel>
      </div>
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this scan?</AlertDialogTitle><AlertDialogDescription>Its results and stored source will be removed. Finding status history is kept.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => { try { await deleteScan(s.id); toast.success("Scan deleted"); navigate({ to: "/history" }); } catch (e) { toast.error((e as Error).message); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

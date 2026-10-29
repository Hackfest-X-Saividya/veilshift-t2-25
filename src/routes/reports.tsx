import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoTag, EmptyState, PageHeader, Panel, fmtTime } from "@/components/friday/ui";
import { buildReport, download, exportPdf } from "@/lib/friday/report";
import { useDB } from "@/lib/friday/store";

export const Route = createFileRoute("/reports")({
  validateSearch: (s: Record<string, unknown>): { scan?: string } => ({ scan: typeof s.scan === "string" ? s.scan : undefined }),
  head: () => ({
    meta: [
      { title: "Reports · FRIDAY" },
      { name: "description", content: "Generate and download PDF or JSON security reports for a scan." },
      { property: "og:title", content: "Reports · FRIDAY" },
      { property: "og:description", content: "Exportable security reports with evidence and remediation." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const db = useDB();
  const { scan: scanId } = Route.useSearch();
  const navigate = useNavigate({ from: "/reports" });
  const [busy, setBusy] = useState(false);
  const scans = [...db.scans].sort((a, b) => b.startedAt - a.startedAt);
  const scan = scans.find((s) => s.id === scanId) ?? scans[0];
  if (!scan) return <><PageHeader eyebrow="Reports" title="Reports" /><EmptyState icon={<FileText className="size-8" />} title="No scans to report on" action={<Button asChild size="sm"><Link to="/scan">Run a scan</Link></Button>} /></>;
  const report = buildReport(db, scan);
  const base = `friday-${(report.project.name ?? "project").replace(/\W+/g, "-").toLowerCase()}-${scan.id}`;

  return (
    <>
      <PageHeader eyebrow="Reports" title="Security report" description="Built from the selected scan's stored results."
        actions={<>
          <select value={scan.id} onChange={(e) => navigate({ search: { scan: e.target.value } })} className="h-8 max-w-[260px] rounded-md border bg-background px-2 text-xs">
            {scans.map((s) => <option key={s.id} value={s.id}>{db.projects.find((p) => p.id === s.projectId)?.name} · {fmtTime(s.startedAt)}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => { download(`${base}.json`, new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })); toast.success("JSON report downloaded"); }}><FileJson className="size-4" />JSON</Button>
          <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await exportPdf(report, `${base}.pdf`); toast.success("PDF report downloaded"); } catch (e) { toast.error(`PDF export failed: ${(e as Error).message}`); } finally { setBusy(false); } }}><FileDown className="size-4" />{busy ? "Generating…" : "PDF"}</Button>
        </>} />
      <article className="panel mx-auto max-w-4xl space-y-6 p-6 text-sm">
        <header>
          <div className="eyebrow">FRIDAY security report</div>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">{report.project.name}{report.project.isDemo && <DemoTag />}</h2>
          <p className="text-xs text-muted-foreground">Scan {scan.id} · {fmtTime(scan.startedAt)} · {report.scan.status.replace(/_/g, " ")} · {report.scan.filesAnalyzed} files · {report.scan.routesFound} routes</p>
        </header>
        <section><h3 className="mb-2 font-medium">Summary</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-1">{Object.entries(report.summary.bySeverity).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{v}</span></li>)}</ul>
            <ul className="space-y-1">{Object.entries(report.summary.byCategory).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{v}</span></li>)}</ul>
          </div>
        </section>
        <section><h3 className="mb-2 font-medium">Scope and limitations</h3><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{report.scope.limitations.map((l) => <li key={l}>{l}</li>)}</ul></section>
        {report.comparison && <section><h3 className="mb-2 font-medium">Comparison with previous scan</h3><p className="text-muted-foreground">{Object.entries(report.comparison.counts).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</p></section>}
        <section><h3 className="mb-2 font-medium">Findings ({report.findings.length})</h3>
          <div className="space-y-5">{report.findings.map((f, i) => (
            <div key={f.id} className="border-t pt-4">
              <div className="font-medium">{i + 1}. [{f.severity}] {f.title}</div>
              <div className="font-mono text-xs text-muted-foreground">{f.rule} · {f.location} · confidence {Math.round(f.confidence * 100)}% · {f.status}</div>
              <p className="mt-2">{f.explanation}</p>
              <pre className="code-surface mt-2 overflow-auto rounded border p-2 font-mono text-xs">{f.statement}</pre>
              <ol className="mt-2 list-decimal pl-5 text-muted-foreground">{f.path.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="mt-2"><span className="font-medium">Remediation: </span>{f.remediation.summary}</p>
              {f.reviewNotes && f.reviewNotes.length > 1 && <p className="mt-1 text-xs text-muted-foreground">Review notes: {f.reviewNotes.join(" · ")}</p>}
            </div>
          ))}{!report.findings.length && <p className="text-muted-foreground">No findings were detected in this scan.</p>}</div>
        </section>
        <footer className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">{report.disclaimer}</footer>
      </article>
    </>
  );
}

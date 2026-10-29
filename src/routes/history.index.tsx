import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoTag, EmptyState, PageHeader, fmtDuration, fmtTime } from "@/components/friday/ui";
import { useDB } from "@/lib/friday/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "Scan history · FRIDAY" },
      { name: "description", content: "Every scan with status, duration, files analyzed and finding counts." },
      { property: "og:title", content: "Scan history · FRIDAY" },
      { property: "og:description", content: "Historical scans and before/after comparisons." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const db = useDB();
  const scans = [...db.scans].sort((a, b) => b.startedAt - a.startedAt);
  return (
    <>
      <PageHeader eyebrow="Scan history" title="Scan history" description="Select a scan to open its stored results." />
      {!scans.length ? <EmptyState icon={<History className="size-8" />} title="No scans yet" action={<Button asChild size="sm"><Link to="/scan">Run a scan</Link></Button>} /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr>{["Started", "Project", "Status", "Files", "Duration", "Findings", "Comparison"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {scans.map((s) => {
                const p = db.projects.find((x) => x.id === s.projectId);
                const canCmp = s.previousScanId && db.scans.some((x) => x.id === s.previousScanId);
                return (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5"><Link to="/history/$scanId" params={{ scanId: s.id }} className="hover:text-primary">{fmtTime(s.startedAt)}</Link></td>
                    <td className="px-3 py-2.5"><span className="flex items-center gap-2">{p?.name}{s.isDemo && <DemoTag />}</span><span className="text-[11px] text-muted-foreground">{s.label}</span></td>
                    <td className={cn("px-3 py-2.5 text-xs", s.status === "completed" ? "text-success" : "text-warning")}>{s.status.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{s.filesAnalyzed}<span className="text-muted-foreground"> / {s.filesSkipped} skipped</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{fmtDuration(s.finishedAt - s.startedAt)}</td>
                    <td className="px-3 py-2.5 font-mono">{s.findings.length}</td>
                    <td className="px-3 py-2.5">{canCmp ? <Link to="/compare" search={{ a: s.previousScanId, b: s.id }} className="text-xs text-primary hover:underline">Compare with previous</Link> : <span className="text-xs text-muted-foreground">First scan</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

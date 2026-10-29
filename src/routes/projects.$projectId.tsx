import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, ScanSearch, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CategoryBadge, DemoTag, EmptyState, PageHeader, Panel, SeverityBadge, StatusBadge, fmtDuration, fmtTime, sevBg } from "@/components/friday/ui";
import { allIssueRows, deleteProject, renameProject, useDB } from "@/lib/friday/store";
import { SEVERITY_LABEL, SEVERITY_ORDER } from "@/lib/friday/types";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project · FRIDAY" },
      { name: "description", content: "Project security summary, file inventory, findings and scan history." },
      { property: "og:title", content: "Project · FRIDAY" },
      { property: "og:description", content: "Per-project security posture in FRIDAY." },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const db = useDB();
  const navigate = useNavigate();
  const p = db.projects.find((x) => x.id === projectId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [del, setDel] = useState(false);
  if (!p) return <EmptyState title="Project not found" action={<Button asChild size="sm"><Link to="/projects">All projects</Link></Button>} />;
  const scans = db.scans.filter((s) => s.projectId === p.id).sort((a, b) => b.startedAt - a.startedAt);
  const latest = scans[0];
  const rows = allIssueRows(db).filter((r) => r.issue.projectId === p.id);
  const open = rows.filter((r) => r.inLatest && r.issue.status !== "fixed");
  const counts = SEVERITY_ORDER.map((s) => ({ s, n: (latest?.findings ?? []).filter((f) => f.severity === s).length }));
  const total = Math.max(1, counts.reduce((a, c) => a + c.n, 0));

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={editing ? (
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { await renameProject(p.id, name); setEditing(false); toast.success("Project renamed"); } catch (err) { toast.error((err as Error).message); } }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" /><Button size="sm" type="submit">Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : <span className="flex items-center gap-2">{p.name}{p.isDemo && <DemoTag />}</span>}
        description={`${p.frameworks.join(", ") || "No framework detected"} · ${p.fileCount} files · last scanned ${fmtTime(p.lastScanAt)}`}
        actions={<>
          <Button size="sm" asChild><Link to="/scan" search={{ project: p.id }}><ScanSearch className="size-4" />Rescan</Link></Button>
          {latest && <Button size="sm" variant="outline" asChild><Link to="/reports" search={{ scan: latest.id }}><FileText className="size-4" />Report</Link></Button>}
          <Button size="sm" variant="ghost" onClick={() => { setName(p.name); setEditing(true); }}><Pencil className="size-4" />Rename</Button>
          <Button size="sm" variant="ghost" onClick={() => setDel(true)}><Trash2 className="size-4" />Delete</Button>
        </>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Latest severity distribution">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">{counts.map((c) => c.n > 0 && <div key={c.s} className={sevBg[c.s]} style={{ width: `${(c.n / total) * 100}%` }} />)}</div>
          <ul className="mt-3 space-y-1 text-sm">{counts.map((c) => <li key={c.s} className="flex justify-between"><span>{SEVERITY_LABEL[c.s]}</span><span className="font-mono">{c.n}</span></li>)}</ul>
        </Panel>
        <Panel title={`Open findings (${open.length})`} className="lg:col-span-2" bodyClassName="p-0">
          {open.length ? (
            <ul className="divide-y">{open.map((r) => (
              <li key={r.issue.key}><Link to="/findings/$key" params={{ key: r.issue.key }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <SeverityBadge s={r.finding.severity} /><span className="flex-1 truncate text-sm">{r.finding.title}</span><CategoryBadge c={r.finding.category} /><StatusBadge s={r.issue.status} v={r.issue.verification} />
              </Link></li>
            ))}</ul>
          ) : <p className="p-6 text-sm text-muted-foreground">No open findings in the latest scan.</p>}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Scan history" bodyClassName="p-0">
          <ul className="divide-y">{scans.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Link to="/history/$scanId" params={{ scanId: s.id }} className="flex-1 hover:text-primary">{fmtTime(s.startedAt)} <span className="text-xs text-muted-foreground">{s.label}</span></Link>
              <span className="font-mono text-xs text-muted-foreground">{s.findings.length} findings · {fmtDuration(s.finishedAt - s.startedAt)}</span>
              {s.previousScanId && db.scans.some((x) => x.id === s.previousScanId) && <Link to="/compare" search={{ a: s.previousScanId, b: s.id }} className="text-xs text-primary hover:underline">Compare</Link>}
            </li>
          ))}</ul>
        </Panel>
        <Panel title="Source inventory & warnings">
          {latest ? (
            <>
              <ul className="max-h-60 space-y-1 overflow-auto font-mono text-xs">{Object.entries(latest.inventory).map(([f, fns]) => <li key={f} className="flex justify-between gap-2"><span className="truncate">{f}</span><span className="text-muted-foreground">{fns.length} functions</span></li>)}</ul>
              {latest.warnings.length ? <ul className="mt-3 space-y-1 text-xs text-warning">{latest.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul> : <p className="mt-3 text-xs text-muted-foreground">No analysis warnings.</p>}
            </>
          ) : <p className="text-sm text-muted-foreground">No scans.</p>}
        </Panel>
      </div>
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {p.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the project, its {scans.length} scans, stored source and finding history from this browser.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => { try { await deleteProject(p.id); toast.success("Project deleted"); navigate({ to: "/projects" }); } catch (e) { toast.error((e as Error).message); } }}>Delete project</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

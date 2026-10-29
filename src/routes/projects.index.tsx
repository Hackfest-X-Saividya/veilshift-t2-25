import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderGit2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoTag, EmptyState, PageHeader, fmtTime } from "@/components/friday/ui";
import { useDB } from "@/lib/friday/store";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects · FRIDAY" },
      { name: "description", content: "All scanned Python projects in your local FRIDAY workspace." },
      { property: "og:title", content: "Projects · FRIDAY" },
      { property: "og:description", content: "Scanned projects, frameworks and open findings." },
    ],
  }),
  component: Projects,
});

function Projects() {
  const db = useDB();
  return (
    <>
      <PageHeader eyebrow="Projects" title="Projects" actions={<Button asChild size="sm"><Link to="/scan"><ScanSearch className="size-4" />New scan</Link></Button>} />
      {!db.projects.length ? (
        <EmptyState icon={<FolderGit2 className="size-8" />} title="No projects yet" action={<Button asChild size="sm"><Link to="/scan">Scan a project</Link></Button>}>Projects are created when you run your first scan.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {db.projects.map((p) => {
            const issues = Object.values(db.issues).filter((i) => i.projectId === p.id);
            const open = issues.filter((i) => i.status !== "fixed").length;
            const scans = db.scans.filter((s) => s.projectId === p.id).length;
            return (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} className="panel p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-2"><FolderGit2 className="size-4 text-primary" /><span className="truncate font-medium">{p.name}</span>{p.isDemo && <DemoTag />}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{p.frameworks.join(", ") || "Python"} · {p.fileCount} files</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Open</div><div className="font-mono text-base">{open}</div></div>
                  <div><div className="text-muted-foreground">Scans</div><div className="font-mono text-base">{scans}</div></div>
                  <div><div className="text-muted-foreground">Last scan</div><div>{fmtTime(p.lastScanAt)}</div></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

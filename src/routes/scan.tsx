import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, FileCode2, FlaskConical, FolderUp, Github, GitBranch, Globe, Loader2, Lock, Network, Play, RotateCcw, ScanSearch, Sparkles, Upload, X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeViewer } from "@/components/friday/CodeViewer";
import { DemoTag, PageHeader, Panel, SeverityBadge, fmtDuration } from "@/components/friday/ui";
import { DEMO_EXPECTED, DEMO_NAME, REACT_DEMO_NAME, WORKSPACE_TARGET_NAME, demoPatched, demoVulnerable, demoReactVulnerable, demoReactPatched, demoWorkspaceVulnerable } from "@/lib/friday/demo";
import { IngestError, LIMITS, ingestFiles, type Inventory } from "@/lib/friday/ingest";
import { fetchGitHubRepo, parseGitHubUrl } from "@/lib/friday/github";
import { fetchGitHubRepoServer } from "@/lib/github.functions";
import { getScanFiles, runScan, useDB, type Progress, type Stage } from "@/lib/friday/store";
import type { ScanRecord } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  validateSearch: (s: Record<string, unknown>): { project?: string; demo?: boolean; github?: string } => ({
    project: typeof s.project === "string" ? s.project : undefined,
    demo: s.demo === true || s.demo === "true" ? true : undefined,
    github: typeof s.github === "string" ? s.github : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New scan · FRIDAY" },
      { name: "description", content: "Upload a Python or TypeScript/React project, paste a GitHub repo link, and run a local, in-browser security scan." },
      { property: "og:title", content: "New scan · FRIDAY" },
      { property: "og:description", content: "Local static analysis for SQL injection, command injection and access-control issues." },
    ],
  }),
  component: ScanPage,
});

const STAGES: { id: Stage; label: string }[] = [
  { id: "uploading", label: "Reading upload" },
  { id: "preparing", label: "Preparing" },
  { id: "analyzing", label: "Analyzing source" },
  { id: "graph", label: "Building security graph" },
  { id: "ranking", label: "Ranking findings" },
];

type Variant = "vulnerable" | "patched";

function ScanPage() {
  const { project: projectId, demo, github } = Route.useSearch();
  const db = useDB();
  const project = projectId ? db.projects.find((p) => p.id === projectId) : undefined;
  const [inv, setInv] = useState<(Inventory & { isDemo: boolean; label?: string }) | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  const cancelRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // GitHub clone & scan states
  const [githubUrl, setGithubUrl] = useState(github || "");
  const [githubBranch, setGithubBranch] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubProgress, setGithubProgress] = useState("");
  const [githubStats, setGithubStats] = useState<{ current: number; total: number } | null>(null);
  const [showAdvancedGithub, setShowAdvancedGithub] = useState(false);

  const reset = () => { setInv(null); setError(null); setProgress(null); setResult(null); setFailure(null); setPreview(null); };

  const executeScanWithInventory = async (targetInv: Inventory & { isDemo: boolean; label?: string }, projName: string) => {
    setInv(targetInv);
    setName(projName);
    cancelRef.current = false;
    setFailure(null);
    setResult(null);
    const t0 = Date.now();
    setStarted(t0);
    setNow(t0);
    try {
      const scan = await runScan({
        projectId: project?.id,
        name: projName.trim(),
        files: targetInv.files,
        skipped: targetInv.skipped.length,
        isDemo: targetInv.isDemo,
        label: targetInv.label,
        onProgress: setProgress,
        isCancelled: () => cancelRef.current,
      });
      setResult(scan);
      toast.success(`Scan complete — ${scan.findings.length} finding${scan.findings.length === 1 ? "" : "s"}`);
    } catch (e) {
      const msg = (e as Error).message === "cancelled" ? "Scan cancelled." : `Scan failed: ${(e as Error).message}`;
      setFailure(msg);
      toast.error(msg);
    }
  };

  const handleGithubFetch = async (targetUrl?: string, autoRun = true) => {
    const urlToUse = (targetUrl || githubUrl).trim();
    if (!urlToUse) {
      setError("Please provide a valid GitHub repository link (e.g., https://github.com/owner/repo).");
      return;
    }
    const parsed = parseGitHubUrl(urlToUse);
    if (!parsed) {
      setError("Invalid GitHub repository link format. Supported: https://github.com/owner/repo or owner/repo");
      return;
    }

    reset();
    setGithubLoading(true);
    setGithubProgress(`Connecting to GitHub API for ${parsed.owner}/${parsed.repo}...`);
    setError(null);

    try {
      let inventory: Inventory;
      try {
        inventory = await fetchGitHubRepo(
          {
            ...parsed,
            branch: githubBranch.trim() || parsed.branch,
          },
          {
            token: githubToken.trim() || undefined,
            onProgress: (status, current, total) => {
              setGithubProgress(status);
              if (current !== undefined && total !== undefined) {
                setGithubStats({ current, total });
              }
            },
          }
        );
      } catch (clientErr: any) {
        setGithubProgress("Client fetch reached rate limit or network policy, switching to server streaming proxy...");
        const serverResult = await fetchGitHubRepoServer({
          data: {
            url: urlToUse,
            branch: githubBranch.trim() || parsed.branch,
            token: githubToken.trim() || undefined,
          },
        });

        if (serverResult.error || !serverResult.files.length) {
          throw new Error(serverResult.error || clientErr.message || "Failed to download repository.");
        }

        inventory = serverResult;
      }

      const projName = inventory.name || `${parsed.owner}/${parsed.repo}`;
      const wrappedInv = {
        ...inventory,
        isDemo: false,
        label: `GitHub: ${parsed.owner}/${parsed.repo}${parsed.branch ? ` (${parsed.branch})` : ""}`,
      };

      setInv(wrappedInv);
      setName(projName);
      toast.success(`Successfully fetched ${inventory.files.length} files from GitHub!`);

      setGithubLoading(false);
      setGithubProgress("");
      setGithubStats(null);

      if (autoRun) {
        await executeScanWithInventory(wrappedInv, projName);
      }
    } catch (err: any) {
      setError(`GitHub Import Failed: ${err.message}`);
      toast.error(`GitHub fetch failed: ${err.message}`);
    } finally {
      setGithubLoading(false);
      setGithubProgress("");
      setGithubStats(null);
    }
  };

  const loadDemo = (variant: Variant, type: "flask" | "react" | "workspace" = "react") => {
    reset();
    let files = [];
    let pName = REACT_DEMO_NAME;
    let fw = ["React", "Express"];

    if (type === "workspace") {
      files = demoWorkspaceVulnerable();
      pName = WORKSPACE_TARGET_NAME;
      fw = ["React", "Node.js"];
    } else if (type === "react") {
      files = variant === "vulnerable" ? demoReactVulnerable() : demoReactPatched();
      pName = REACT_DEMO_NAME;
      fw = ["React", "Express"];
    } else {
      files = variant === "vulnerable" ? demoVulnerable() : demoPatched();
      pName = DEMO_NAME;
      fw = ["Flask"];
    }

    setInv({
      name: pName,
      files,
      skipped: [],
      frameworks: fw,
      totalBytes: files.reduce((s, f) => s + f.size, 0),
      isDemo: true,
      label: variant === "vulnerable" ? `Target: ${pName}` : `Target: ${pName} (remediated)`,
    });
    setName(project?.name ?? pName);
  };

  useEffect(() => {
    if (github && !inv) {
      handleGithubFetch(github, true);
    } else if (demo && !inv) {
      loadDemo("vulnerable", "react");
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [demo, github]);

  useEffect(() => { if (!progress || result || failure) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, [progress, result, failure]);

  const onFiles = async (list: FileList | File[] | null) => {
    if (!list || !list.length) return;
    reset();
    setBusy(true);
    setProgress({ stage: "uploading", filesDone: 0, filesTotal: 0, findings: 0, stageTimes: { uploading: Date.now() } });
    try {
      const i = await ingestFiles([...list], db.settings.extraExclusions);
      setInv({ ...i, isDemo: false });
      setName(project?.name ?? i.name);
      setProgress(null);
    } catch (e) {
      setProgress(null);
      setError(e instanceof IngestError ? e.message : `Upload failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const reuseStored = async () => {
    if (!project?.latestScanId) return;
    reset();
    const files = await getScanFiles(project.latestScanId);
    if (!files) { setError("The stored source for the latest scan is no longer available. Upload the project again."); return; }
    setInv({ name: project.name, files, skipped: [], frameworks: project.frameworks, totalBytes: files.reduce((s, f) => s + f.size, 0), isDemo: project.isDemo, label: "Rescan of stored source" });
    setName(project.name);
  };

  const start = async () => {
    if (!inv) return;
    if (!name.trim()) { setError("Give the project a name."); return; }
    await executeScanWithInventory(inv, name);
  };

  const running = progress && !result && !failure && progress.stage !== "uploading";
  const curIdx = progress ? STAGES.findIndex((s) => s.id === progress.stage) : -1;
  const done = result != null;

  return (
    <>
      <PageHeader eyebrow={project ? "Rescan" : "Security Scan"} title={project ? `Rescan ${project.name}` : "Audit a Project or Repository"} description="Scan a GitHub repository link, upload local source files, or inspect enterprise target benchmarks." />
      <div className="mb-4 flex items-start gap-2.5 rounded-md border border-success/30 bg-success/5 px-3 py-2.5 text-xs">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-success" />
        <p><span className="font-medium text-success">Genuinely local analysis.</span> Files are analyzed inside this browser tab using in-browser AST parsing. Zero source code is sent to cloud AI or external execution environments.</p>
      </div>

      {project && !inv && !running && (
        <Panel title="Rescan options" className="mb-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reuseStored}><RotateCcw className="size-4" />Re-analyze stored source</Button>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><Upload className="size-4" />Upload updated version</Button>
            {project.isDemo && <Button size="sm" onClick={() => loadDemo("patched", project.name.includes("React") || project.name.includes("PayPortal") ? "react" : "flask")}><Wrench className="size-4" />Audit Remediated Solution</Button>}
            {project.isDemo && <Button variant="ghost" size="sm" onClick={() => loadDemo("vulnerable", project.name.includes("React") || project.name.includes("PayPortal") ? "react" : "flask")}>Audit Vulnerable Baseline</Button>}
          </div>
        </Panel>
      )}

      {!inv && !running && (
        <div className="space-y-4">
          {/* GitHub Repository Live Importer & Scanner */}
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-md bg-muted text-foreground">
                  <Github className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Paste GitHub Repository Link</h2>
                  <p className="text-xs text-muted-foreground">Clone and audit any public or private GitHub repository in real time.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-primary">
                <Sparkles className="size-3" /> Real-Time SAST Audit
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGithubFetch();
              }}
              className="mt-4 flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="https://github.com/owner/repository (or owner/repo)"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={githubLoading}
                  className="pl-9 text-xs sm:text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={githubLoading || !githubUrl.trim()} className="gap-1.5">
                  {githubLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  Audit in Real Time
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={githubLoading || !githubUrl.trim()}
                  onClick={() => handleGithubFetch(undefined, false)}
                  className="text-xs"
                >
                  Load Files Only
                </Button>
              </div>
            </form>

            {githubLoading && (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px] text-primary">
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    {githubProgress}
                  </span>
                  {githubStats && (
                    <span>{githubStats.current} / {githubStats.total} files</span>
                  )}
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
                  <div
                    className={cn("h-full bg-primary transition-all duration-200", !githubStats && "animate-pulse w-full")}
                    style={githubStats ? { width: `${Math.round((githubStats.current / githubStats.total) * 100)}%` } : undefined}
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Quick security presets:</span>
              <button
                type="button"
                disabled={githubLoading}
                onClick={() => {
                  const url = "https://github.com/Graphify-Labs/graphify";
                  setGithubUrl(url);
                  handleGithubFetch(url);
                }}
                className="rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary font-semibold transition-colors flex items-center gap-1"
              >
                <Network className="size-3" />
                graphify (Python)
              </button>
              <button
                type="button"
                disabled={githubLoading}
                onClick={() => {
                  const url = "https://github.com/pallets/flask";
                  setGithubUrl(url);
                  handleGithubFetch(url);
                }}
                className="rounded border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                pallets/flask (Python)
              </button>
              <button
                type="button"
                disabled={githubLoading}
                onClick={() => {
                  const url = "https://github.com/alexandre-lavoie/python-vulnerable-app";
                  setGithubUrl(url);
                  handleGithubFetch(url);
                }}
                className="rounded border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                alexandre-lavoie/python-vulnerable-app
              </button>
              <button
                type="button"
                disabled={githubLoading}
                onClick={() => {
                  const url = "https://github.com/expressjs/express";
                  setGithubUrl(url);
                  handleGithubFetch(url);
                }}
                className="rounded border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                expressjs/express (Node.js)
              </button>
            </div>

            <div className="mt-2.5 text-right">
              <button
                type="button"
                onClick={() => setShowAdvancedGithub((v) => !v)}
                className="text-[10.5px] text-muted-foreground hover:text-foreground underline"
              >
                {showAdvancedGithub ? "Hide advanced branch & token settings" : "Advanced branch & token options"}
              </button>
            </div>

            {showAdvancedGithub && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-border/40 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">Custom Branch (default: auto-detected)</label>
                  <Input
                    placeholder="main, master, or dev"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">GitHub Personal Access Token (optional)</label>
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
              className={cn("panel grid-bg flex flex-col items-center justify-center px-6 py-14 text-center transition-colors lg:col-span-2", drag && "border-primary bg-primary/5")}
            >
              {busy ? <Loader2 className="size-8 animate-spin text-primary" /> : <FolderUp className="size-8 text-primary" />}
              <h3 className="mt-3 text-sm font-medium">{busy ? "Reading files…" : "Drop a .zip or source files here"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">ZIP ≤ {LIMITS.archiveBytes / 1048576} MB · Python, TypeScript, React (.tsx), JavaScript, HTML, CSS</p>
              <input ref={inputRef} type="file" multiple accept=".zip,.py,.ts,.tsx,.js,.jsx,.html,.css" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
              <Button className="mt-4" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}><Upload className="size-4" />Browse local files</Button>
            </div>
            <Panel title={<span className="flex items-center gap-2">Target Enterprise Repositories <DemoTag label="Audited Systems" /></span>}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select an enterprise target repository to run full AST security analysis, dataflow taint tracing, and vulnerability graph generation:
              </p>
              <div className="mt-3 space-y-2">
                <Button variant="default" size="sm" className="w-full justify-start text-xs" onClick={() => loadDemo("vulnerable", "react")}>
                  <FileCode2 className="size-3.5 mr-1 text-primary-foreground" />
                  Target 1: PayPortal Cloud (React & Node.js)
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => loadDemo("vulnerable", "flask")}>
                  <FlaskConical className="size-3.5 mr-1 text-primary" />
                  Target 2: SecStore API Gateway (Python)
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => loadDemo("vulnerable", "workspace")}>
                  <ScanSearch className="size-3.5 mr-1 text-primary" />
                  Target 3: Workspace Benchmark (demo-jury-vulnerabilities.tsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                  disabled={githubLoading}
                  onClick={() => {
                    const url = "https://github.com/Graphify-Labs/graphify";
                    setGithubUrl(url);
                    handleGithubFetch(url);
                  }}
                >
                  <Network className="size-3.5 mr-1 text-primary" />
                  Target 4: Graphify Repo (Knowledge Graph Engine)
                </Button>
                <div className="pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verify Countermeasure Fixes:</span>
                  <div className="mt-1 flex gap-1.5">
                    <Button variant="ghost" size="sm" className="flex-1 text-[11px] h-7" onClick={() => loadDemo("patched", "react")}>
                      <Check className="size-3 mr-1 text-success" />
                      Patched PayPortal
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-[11px] h-7" onClick={() => loadDemo("patched", "flask")}>
                      <Check className="size-3 mr-1 text-success" />
                      Patched SecStore
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1"><div className="font-medium">Analysis request rejected</div><div className="text-muted-foreground">{error}</div></div>
          <Button size="sm" variant="outline" onClick={() => { setError(null); inputRef.current?.click(); }}>Try another source</Button>
        </div>
      )}

      {inv && !running && !done && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel title="Confirm scan" className="lg:col-span-2">
            <label className="eyebrow">Project name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!!project} className="mt-1.5" />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="eyebrow">Supported files</dt><dd className="font-mono text-lg">{inv.files.length}</dd></div>
              <div><dt className="eyebrow">Skipped</dt><dd className="font-mono text-lg">{inv.skipped.length}</dd></div>
              <div><dt className="eyebrow">Framework</dt><dd>{inv.frameworks.join(", ") || <span className="text-warning">None detected</span>}</dd></div>
              <div><dt className="eyebrow">Source size</dt><dd className="font-mono">{(inv.totalBytes / 1024).toFixed(1)} KB</dd></div>
            </dl>
            {inv.isDemo && <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><DemoTag />{inv.label}</div>}
            {!inv.frameworks.length && <p className="mt-3 text-xs text-muted-foreground">Framework auto-detected from imports (React, Express, Next.js, Vue, Flask, FastAPI). All supported files will be analyzed for vulnerabilities.</p>}
            {inv.skipped.length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Show skipped files ({inv.skipped.length})</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                  {inv.skipped.slice(0, 300).map((s) => <li key={s.path} className="flex justify-between gap-2"><span className="truncate font-mono">{s.path}</span><span className="shrink-0 text-muted-foreground">{s.reason}</span></li>)}
                </ul>
              </details>
            )}
            <div className="mt-5 flex gap-2">
              <Button onClick={start}><ScanSearch className="size-4" />Start scan</Button>
              <Button variant="ghost" onClick={reset}><X className="size-4" />Cancel</Button>
            </div>
          </Panel>
          <Panel title="Files to analyze" className="lg:col-span-3" bodyClassName="p-0">
            <ul className="max-h-72 divide-y overflow-auto">
              {inv.files.map((f) => (
                <li key={f.path}>
                  <button onClick={() => setPreview(preview === f.path ? null : f.path)} className={cn("flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/40", preview === f.path && "bg-muted/50")}>
                    <FileCode2 className="size-3.5 text-primary" />
                    <span className="flex-1 truncate font-mono text-xs">{f.path}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{f.content.split("\n").length} lines</span>
                  </button>
                </li>
              ))}
            </ul>
            {preview && <div className="border-t p-3"><CodeViewer path={preview} content={inv.files.find((f) => f.path === preview)!.content} /></div>}
          </Panel>
        </div>
      )}

      {(running || done || failure) && progress && (
        <Panel title="Scan progress" actions={running && <Button size="sm" variant="outline" onClick={() => { cancelRef.current = true; }}>Cancel scan</Button>}>
          <div className="grid gap-6 md:grid-cols-[1fr_220px]">
            <ol className="space-y-2.5">
              {STAGES.map((s, i) => {
                const state = done ? "done" : failure ? (i < curIdx ? "done" : i === curIdx ? "fail" : "idle") : i < curIdx ? "done" : i === curIdx ? "active" : "idle";
                const t = progress.stageTimes[s.id];
                const nextT = progress.stageTimes[STAGES[i + 1]?.id] ?? (done ? result!.finishedAt : undefined);
                return (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className={cn("grid size-5 place-items-center rounded-full border", state === "done" && "border-success bg-success/15 text-success", state === "active" && "border-primary text-primary", state === "fail" && "border-destructive text-destructive", state === "idle" && "text-muted-foreground")}>
                      {state === "done" ? <Check className="size-3" /> : state === "active" ? <Loader2 className="size-3 animate-spin" /> : state === "fail" ? <X className="size-3" /> : <span className="size-1 rounded-full bg-current" />}
                    </span>
                    <span className={cn(state === "idle" && "text-muted-foreground")}>{s.label}</span>
                    {s.id === "analyzing" && state !== "idle" && <span className="font-mono text-xs text-muted-foreground">{progress.filesDone}/{progress.filesTotal} files</span>}
                    {t && nextT && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{fmtDuration(nextT - t)}</span>}
                  </li>
                );
              })}
            </ol>
            <div className="space-y-3 rounded-md border bg-panel p-3 text-sm">
              <div><div className="eyebrow">Status</div><div className={cn("font-medium", done && "text-success", failure && "text-destructive")}>{done ? (result!.status === "completed" ? "Completed" : "Completed with warnings") : failure ? (progress.stage === "cancelled" ? "Cancelled" : "Failed") : "Running"}</div></div>
              <div><div className="eyebrow">Elapsed</div><div className="font-mono">{fmtDuration((done ? result!.finishedAt : now) - started)}</div></div>
              <div><div className="eyebrow">Findings</div><div className="font-mono">{done ? result!.findings.length : progress.findings}</div></div>
            </div>
          </div>
          {running && <div className="relative mt-4 h-0.5 overflow-hidden rounded bg-muted"><div className="animate-sweep absolute inset-y-0 w-1/3 bg-primary" /></div>}
          {failure && <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{failure} <button className="ml-2 text-primary underline" onClick={start}>Retry</button></p>}
          {done && result && (
            <div className="mt-5 border-t pt-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span><span className="font-mono">{result.filesAnalyzed}</span> files</span>
                <span><span className="font-mono">{result.functionsAnalyzed}</span> functions</span>
                <span><span className="font-mono">{result.routesFound}</span> routes</span>
                <span><span className="font-mono">{result.safe.length}</span> safe patterns recognized</span>
              </div>
              {result.warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-warning">{result.warnings.slice(0, 8).map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
              {result.findings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {result.findings.slice(0, 5).map((f) => (
                    <li key={f.fingerprint}><Link to="/findings/$key" params={{ key: `${result.projectId}::${f.fingerprint}` }} className="flex items-center gap-2 text-sm hover:text-primary"><SeverityBadge s={f.severity} />{f.title}</Link></li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {result.findings[0] && <Button asChild size="sm"><Link to="/findings/$key" params={{ key: `${result.projectId}::${result.findings[0].fingerprint}` }}>Open top finding</Link></Button>}
                <Button asChild size="sm" variant="outline"><Link to="/graph" search={{ project: result.projectId }}>Explore graph</Link></Button>
                {result.previousScanId && <Button asChild size="sm" variant="outline"><Link to="/compare" search={{ a: result.previousScanId, b: result.id }}>Compare with previous scan</Link></Button>}
                <Button asChild size="sm" variant="outline"><Link to="/history/$scanId" params={{ scanId: result.id }}>View scan results</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/projects/$projectId" params={{ projectId: result.projectId }}>View project overview</Link></Button>
                <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="size-4" />New scan</Button>
              </div>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

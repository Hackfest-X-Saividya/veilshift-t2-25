import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart, CartesianGrid } from "recharts";
import { ArrowRight, CheckCircle2, ChevronRight, Compass, Cpu, FileText, FlaskConical, GitCompare, Github, Globe, Layers, Network, Play, Radio, ScanSearch, Shield, ShieldAlert, ShieldCheck, Sparkles, Zap, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryBadge, Confidence, DemoTag, EmptyState, PageHeader, Panel, SeverityBadge, Stat, StatusBadge, fmtTime } from "@/components/friday/ui";
import { allIssueRows, useDB } from "@/lib/friday/store";
import { CATEGORY_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, type Category } from "@/lib/friday/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · FRIDAY Security" },
      { name: "description", content: "Real-time vulnerability intelligence, taint flow analysis, and remediation tracking with zero code exfiltration." },
      { property: "og:title", content: "Overview · FRIDAY" },
      { property: "og:description", content: "Explainable code-security dashboard for Python web apps." },
    ],
  }),
  component: Overview,
});

// Color mapping reflecting: Deep Burgundy, Terracotta Amber, Sage Olive, Slate Sea Blue
const SEV_VAR: Record<string, string> = {
  critical: "#7d1c33",
  high: "#b85d38",
  medium: "#627760",
  low: "#547585",
  info: "#778574",
};

const CAT_VAR: Record<Category, string> = {
  sqli: "#5c182d",  // Deep Burgundy
  cmdi: "#7d1c33",  // Crimson Burgundy
  access: "#627760", // Sage Olive
};

const glassTooltipStyle = {
  background: "rgba(255, 253, 248, 0.94)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(215, 219, 212, 0.7)",
  borderRadius: 14,
  boxShadow: "0 12px 32px rgba(85, 95, 80, 0.12)",
  fontSize: 12,
  color: "#221c1f",
  padding: "8px 12px",
};

function Overview() {
  const db = useDB();
  const navigate = useNavigate();
  const [quickGithub, setQuickGithub] = useState("");
  const rows = allIssueRows(db);
  const openRows = rows.filter((r) => r.issue.status !== "fixed");
  const fixed = rows.filter((r) => r.issue.status === "fixed");
  const verified = fixed.filter((r) => r.issue.verification === "verified_fixed");
  const critHigh = openRows.filter((r) => r.finding.severity === "critical" || r.finding.severity === "high").length;
  const latest = [...db.scans].sort((a, b) => b.startedAt - a.startedAt)[0];

  const healthScore = rows.length === 0 ? 100 : Math.max(10, Math.round(100 - (critHigh * 25 + (openRows.length - critHigh) * 10)));
  const progress = rows.length ? Math.round((fixed.length / rows.length) * 100) : 0;

  if (!db.projects.length) {
    return (
      <div className="space-y-6">
        {/* Clean, Grounded Hero Banner */}
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8 shadow-xs">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Cpu className="size-3.5" />
              In-Browser Python AST Analysis
            </div>

            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl leading-snug">
              Code Security Analysis Platform
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Scan TypeScript, React (.tsx/.jsx), JavaScript, HTML, CSS, and Python for critical vulnerabilities, XSS, injection sinks, and exposed secrets.
              Runs 100% locally in your browser — zero source code is transmitted to cloud servers.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (quickGithub.trim()) {
                  navigate({ to: "/scan", search: { github: quickGithub.trim() } });
                }
              }}
              className="mt-5 flex flex-col sm:flex-row gap-2 max-w-xl"
            >
              <div className="relative flex-1">
                <Github className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Paste GitHub link: https://github.com/owner/repo"
                  value={quickGithub}
                  onChange={(e) => setQuickGithub(e.target.value)}
                  className="pl-9 h-9 text-xs sm:text-sm font-mono"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1.5 h-9" disabled={!quickGithub.trim()}>
                <Play className="size-3.5" />
                Audit in Real Time
              </Button>
            </form>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">Quick presets:</span>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/Graphify-Labs/graphify" } })}
                className="rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary font-semibold transition-colors flex items-center gap-1"
              >
                <Network className="size-3" />
                graphify (Python)
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/pallets/flask" } })}
                className="rounded border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                flask
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/expressjs/express" } })}
                className="rounded border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                express
              </button>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <Link
                to="/scan"
                search={{ demo: true }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <ShieldAlert className="size-3.5 text-primary" />
                Enterprise Target Benchmarks
              </Link>
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <ScanSearch className="size-3.5" />
                Upload Project ZIP / Files
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Network className="size-4.5" />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-foreground">Interactive Taint Graph</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Inspect parameter propagation paths from untrusted HTTP origins to execution sinks.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#4d6349]/10 text-[#4d6349] dark:text-[#a3b89f]">
              <FlaskConical className="size-4.5" />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-foreground">Countermeasure Lab</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Test sanitized inputs, parameterized queries, and validation schemas in real-time.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#2e6930]/10 text-[#2e6930] dark:text-[#6ba874]">
              <ShieldCheck className="size-4.5" />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-foreground">Client-Side Privacy</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Static analysis runs entirely in-browser. Your source code is never executed or dispatched externally.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sevData = SEVERITY_ORDER.map((s) => ({
    s,
    name: SEVERITY_LABEL[s],
    value: openRows.filter((r) => r.finding.severity === s).length,
  }));

  const catData = (Object.keys(CATEGORY_LABEL) as Category[])
    .map((c) => ({
      c,
      name: CATEGORY_LABEL[c],
      value: openRows.filter((r) => r.finding.category === c).length,
    }))
    .filter((d) => d.value > 0);

  const timeline = [...db.scans]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-20)
    .map((s) => ({
      name:
        new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " +
        new Date(s.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      findings: s.findings.length,
      id: s.id,
    }));

  return (
    <div className="space-y-6">
      {/* Hero Section directly inspired by the uploaded reference screenshot */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 dark:border-white/10 bg-card/85 p-6 sm:p-9 backdrop-blur-2xl shadow-sm">
        <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Typography & Pill Controls */}
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5c182d] dark:text-[#c25272] backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                Local Privacy Guard · In-Browser AST
              </div>
              {latest && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 font-mono text-[10px] font-medium text-muted-foreground backdrop-blur-md">
                  <span>Target:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {latest.label || db.projects.find((p) => p.id === latest.projectId)?.name || "Active Workspace"}
                  </span>
                  <span>·</span>
                  <span>{latest.filesAnalyzed} {latest.filesAnalyzed === 1 ? "file" : "files"}</span>
                </div>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl leading-tight">
              Security Overview <br />
              <span className="text-muted-foreground font-normal text-xl sm:text-2xl block mt-1">
                Real-Time AST Taint Analysis & Exposure Posture
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
              Deterministic static taint analysis tracing untrusted inputs across route handlers, sanitizer barriers, and execution sinks in Python, TypeScript, and React — evaluated 100% locally with zero code exfiltration.
            </p>

            {/* Quick Action Capsules (matching reference buttons) */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {/* Deep Burgundy Pill Button */}
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-[#731b32] hover:scale-105 active:scale-95 transition-all"
              >
                <ScanSearch className="size-3.5" />
                Launch New Scan
              </Link>

              {/* Soft Cream & Sage Secondary Pills */}
              <Link
                to="/findings"
                className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-xs font-semibold text-foreground backdrop-blur-xl hover:bg-white transition-all shadow-sm"
              >
                <ShieldAlert className="size-3.5 text-[#7d1c33]" />
                Open Findings ({openRows.length})
              </Link>

              <Link
                to="/graph"
                className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-xs font-semibold text-foreground backdrop-blur-xl hover:bg-white transition-all shadow-sm"
              >
                <Network className="size-3.5 text-[#547585]" />
                Security Graph
              </Link>

              <Link
                to="/lab"
                className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-xs font-semibold text-foreground backdrop-blur-xl hover:bg-white transition-all shadow-sm"
              >
                <FlaskConical className="size-3.5 text-[#627760]" />
                Countermeasures
              </Link>
            </div>

            {/* Quick GitHub Scan Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (quickGithub.trim()) {
                  navigate({ to: "/scan", search: { github: quickGithub.trim() } });
                }
              }}
              className="mt-5 flex flex-col sm:flex-row gap-2 max-w-lg"
            >
              <div className="relative flex-1">
                <Github className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Paste GitHub repository link to audit..."
                  value={quickGithub}
                  onChange={(e) => setQuickGithub(e.target.value)}
                  className="pl-9 h-9 text-xs font-mono rounded-lg bg-background/80"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1.5 h-9" disabled={!quickGithub.trim()}>
                <Play className="size-3.5" />
                Audit Live
              </Button>
            </form>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">Quick presets:</span>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/Graphify-Labs/graphify" } })}
                className="rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2.5 py-0.5 font-mono text-[10px] text-primary font-semibold transition-colors flex items-center gap-1"
              >
                <Network className="size-3" />
                graphify (Python)
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/pallets/flask" } })}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                flask
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/scan", search: { github: "https://github.com/expressjs/express" } })}
                className="rounded-full border border-border/80 bg-background/60 hover:bg-muted px-2.5 py-0.5 font-mono text-[10px] text-foreground transition-colors"
              >
                express
              </button>
            </div>
          </div>

          {/* Right Column: Clean Solid Metric Cards */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
            {/* Card 1: Posture Score */}
            <div className="col-span-1 rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="eyebrow text-muted-foreground font-semibold">Posture Score</span>
                <div className="mt-2 font-mono text-4xl font-extrabold text-foreground">
                  {healthScore}%
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs pt-2.5 border-t border-border font-medium text-muted-foreground">
                <span className={critHigh > 0 ? "text-sev-critical font-semibold" : "text-success font-semibold"}>
                  {critHigh === 0 ? "Optimal" : `${critHigh} Critical`}
                </span>
                <ShieldCheck className={critHigh === 0 ? "size-4 text-success" : "size-4 text-sev-critical"} />
              </div>
            </div>

            {/* Card 2: Fix Velocity */}
            <div className="col-span-1 rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="eyebrow text-muted-foreground font-semibold">Fix Velocity</span>
                <div className="mt-2 font-mono text-4xl font-extrabold text-success">
                  {progress}%
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs pt-2.5 border-t border-border font-medium text-muted-foreground">
                <span className="text-success font-semibold">{verified.length} Verified</span>
                <CheckCircle2 className="size-4 text-success" />
              </div>
            </div>

            {/* Bottom Capsule Card */}
            <div className="col-span-2 rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-2.5 rounded-full bg-primary" />
                <div className="text-xs font-semibold text-foreground">
                  {latest ? `Latest Scan: ${latest.status.replace(/_/g, " ")}` : "Scanner Ready"}
                </div>
              </div>
              <Link to="/history" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Inspect Scans
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Metric Stat Cards (Warm Cream Beige + Sage Grey + Deep Burgundy) */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Projects" value={db.projects.length} to="/projects" hint="Configured" />
        <Stat label="Total Scans" value={db.scans.length} to="/history" hint="AST executions" />
        <Stat label="Open Findings" value={openRows.length} to="/findings" tone="primary" hint="Pending fix" />
        <Stat
          label="Critical + High"
          value={critHigh}
          tone={critHigh ? "critical" : undefined}
          hint={critHigh ? "Needs attention" : "Clean state"}
          to="/findings"
        />
        <Stat label="Resolved" value={fixed.length} hint={`${verified.length} verified`} tone="success" />
        <Stat
          label="Engine Status"
          value={<span className="text-sm font-semibold">Active</span>}
          hint="Local Python AST"
          to="/settings"
        />
      </div>

      {/* Visual Analytics Row */}
      <div className="grid gap-4.5 lg:grid-cols-3">
        <Panel title="Severity Breakdown" className="lg:col-span-1">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevData} layout="vertical" margin={{ left: 10, right: 16, top: 8, bottom: 8 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={86}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={glassTooltipStyle} cursor={{ fill: "rgba(126, 142, 123, 0.08)" }} />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(d: { s?: string }) => d.s && navigate({ to: "/findings", search: { sev: d.s } })}
                >
                  {sevData.map((d) => (
                    <Cell key={d.s} fill={SEV_VAR[d.s]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Vulnerability Categories">
          {catData.length ? (
            <div className="flex h-52 items-center gap-4">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={catData}
                    dataKey="value"
                    innerRadius={46}
                    outerRadius={74}
                    paddingAngle={3}
                    stroke="none"
                    cursor="pointer"
                    onClick={(d: { c?: string }) => d.c && navigate({ to: "/findings", search: { cat: d.c } })}
                  >
                    {catData.map((d) => (
                      <Cell key={d.c} fill={CAT_VAR[d.c]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={glassTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2.5 text-xs flex-1">
                {catData.map((d) => (
                  <li key={d.c}>
                    <Link
                      to="/findings"
                      search={{ cat: d.c }}
                      className="group flex items-center justify-between rounded-xl p-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shadow-sm" style={{ background: CAT_VAR[d.c] }} />
                        <span className="font-semibold text-foreground">{d.name}</span>
                      </div>
                      <span className="font-mono font-bold text-muted-foreground group-hover:text-primary">{d.value}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground font-medium">
              No open findings in workspace.
            </div>
          )}
        </Panel>

        <Panel title="Remediation Progress">
          <div className="flex h-52 flex-col justify-between py-1">
            <div>
              <div className="font-mono text-4xl font-extrabold text-[#49754f] dark:text-[#6ba874]">
                {progress}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-medium">
                {fixed.length} of {rows.length} tracked findings resolved
              </div>
            </div>

            <div className="my-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#49754f] to-[#70856d] transition-all duration-500 shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-white/50 dark:bg-white/5 p-3 text-xs">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Verified</div>
                <div className="font-mono font-bold text-[#49754f] dark:text-[#6ba874] text-sm">{verified.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Unverified</div>
                <div className="font-mono font-bold text-foreground text-sm">{fixed.length - verified.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Recurring</div>
                <div className="font-mono font-bold text-[#7d1c33] dark:text-[#e05d7f] text-sm">
                  {rows.filter((r) => r.issue.status === "recurring").length}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Indexed Findings & Scans Row */}
      <div className="grid gap-4.5 lg:grid-cols-3">
        <Panel
          title="Highest-Priority Open Findings"
          className="lg:col-span-2"
          actions={
            <Link to="/findings" className="inline-flex items-center gap-1 text-xs font-semibold text-[#5c182d] dark:text-[#c25272] hover:underline">
              View all
              <ChevronRight className="size-3" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {openRows.length ? (
            <ul className="divide-y divide-border/40">
              {openRows
                .sort((a, b) => b.finding.score - a.finding.score)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.issue.key}>
                    <Link
                      to="/findings/$key"
                      params={{ key: r.issue.key }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <SeverityBadge s={r.finding.severity} className="w-[96px] shrink-0 justify-center" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{r.finding.title}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground mt-0.5">
                          {r.project?.name} · {r.finding.file}:{r.finding.line}
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <CategoryBadge c={r.finding.category} />
                      </div>
                      <Confidence c={r.finding.confidence} compact />
                      <StatusBadge s={r.issue.status} v={r.issue.verification} />
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground font-medium">
              No open security findings. All systems clear.
            </div>
          )}
        </Panel>

        <Panel title="Scanned Projects" bodyClassName="p-0">
          <ul className="divide-y divide-border/40">
            {[...db.projects]
              .sort((a, b) => (b.lastScanAt ?? 0) - (a.lastScanAt ?? 0))
              .slice(0, 5)
              .map((p) => {
                const n = rows.filter((r) => r.issue.projectId === p.id && r.issue.status !== "fixed").length;
                return (
                  <li key={p.id}>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate text-sm font-bold text-foreground">
                          {p.name}
                          {p.isDemo && <DemoTag />}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {p.frameworks.join(", ") || "Python"} · {fmtTime(p.lastScanAt)}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                        {n} open
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground/60" />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </Panel>
      </div>

      {/* Scan Activity Timeline Graph */}
      <Panel title="Scan Activity & Findings Velocity">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={timeline}
              margin={{ left: -20, right: 10, top: 8, bottom: 0 }}
              onClick={(e) => {
                const id = (e?.activePayload?.[0]?.payload as { id?: string })?.id;
                if (id) navigate({ to: "/history/$scanId", params: { scanId: id } });
              }}
            >
              <defs>
                <linearGradient id="warmArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5c182d" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5c182d" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(126, 142, 123, 0.15)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={glassTooltipStyle} />
              <Area type="monotone" dataKey="findings" stroke="#5c182d" fill="url(#warmArea)" strokeWidth={2.5} cursor="pointer" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

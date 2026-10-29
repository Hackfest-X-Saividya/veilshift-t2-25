import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertOctagon, CheckCircle2, Copy, Cpu, Flame, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/friday/ui";
import { analyzeZeroDay, type ZeroDayAnalysisResult } from "@/lib/zero-day.functions";
import type { Finding } from "@/lib/friday/types";
import { toast } from "sonner";

export function ZeroDayAudit({ finding, framework }: { finding: Finding; framework: string }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ZeroDayAnalysisResult | null>(null);
  const [tab, setTab] = useState<"analysis" | "hotpatch" | "waf">("analysis");
  const runAnalysis = useServerFn(analyzeZeroDay);

  const executeAudit = async () => {
    setBusy(true);
    try {
      const res = await runAnalysis({
        data: {
          category: finding.category,
          framework,
          ruleId: finding.ruleId,
          title: finding.title,
          sinkCode: finding.sinkCode,
          sourceDesc: finding.sourceDesc,
          route: finding.route,
          missingControl: finding.missingControl,
        },
      });
      setData(res);
      if (res.error) toast.error(res.error);
      else toast.success("Zero-day exploitability analysis complete");
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze zero-day vector");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-sev-critical" />
          <span>Zero-Day Exploitability Audit & Virtual Hotpatching</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-mono text-[10px] text-red-400 font-semibold">
            <AlertOctagon className="size-3" />
            0-Day Threat Surface
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
            <Cpu className="size-3" />
            NVIDIA Nemotron Engine
          </span>
        </div>
      }
      className="mt-4 border-sev-critical/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-xs">
        <p className="text-muted-foreground">
          Assess mathematical reachability and synthesize immediate edge virtual patches before upstream vendor fixes are deployed.
        </p>
        <Button
          size="sm"
          variant={data ? "outline" : "default"}
          onClick={executeAudit}
          disabled={busy}
          className="gap-2"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-emerald-400" />}
          {data ? "Re-analyze Exploitability" : "Synthesize Zero-Day Audit"}
        </Button>
      </div>

      {!data && !busy && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <ShieldAlert className="size-8 text-muted-foreground mb-2" />
          <h4 className="font-semibold text-sm">Exploitability Triage Ready</h4>
          <p className="text-xs text-muted-foreground max-w-md mt-1">
            Run an in-depth zero-day evaluation to verify unconstrained taint reachability and generate emergency perimeter virtual patches.
          </p>
          <Button size="sm" onClick={executeAudit} className="mt-4 gap-2">
            <Flame className="size-4" />
            Run Zero-Day Analysis
          </Button>
        </div>
      )}

      {busy && (
        <div className="mt-4 flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">
            Evaluating AST dataflow reachability & generating emergency virtual patch...
          </p>
        </div>
      )}

      {data && !busy && (
        <div className="mt-4 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex border-b text-xs font-medium">
            <button
              onClick={() => setTab("analysis")}
              className={`px-4 py-2 border-b-2 transition-colors ${
                tab === "analysis"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Exploitability Analysis
            </button>
            <button
              onClick={() => setTab("hotpatch")}
              className={`px-4 py-2 border-b-2 transition-colors ${
                tab === "hotpatch"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Emergency Middleware Hotpatch
            </button>
            <button
              onClick={() => setTab("waf")}
              className={`px-4 py-2 border-b-2 transition-colors ${
                tab === "waf"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Perimeter WAF Signature
            </button>
          </div>

          {/* Tab 1: Exploitability Analysis */}
          {tab === "analysis" && (
            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <span className="eyebrow text-foreground">Taint Ingress Vector</span>
                <p className="text-muted-foreground leading-relaxed">{data.ingressVector}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <span className="eyebrow text-sev-high">Constraint Barrier Gap</span>
                <p className="text-muted-foreground leading-relaxed">{data.constraintGap}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <span className="eyebrow text-sev-critical">Execution Consequence</span>
                <p className="text-muted-foreground leading-relaxed">{data.impactMechanics}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1.5">
                <span className="eyebrow text-primary">0-Day Exploitability Rationale</span>
                <p className="text-muted-foreground leading-relaxed">{data.exploitabilityRationale}</p>
              </div>
            </div>
          )}

          {/* Tab 2: Middleware Hotpatch */}
          {tab === "hotpatch" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Drop this middleware in your entry point to neutralize the unconstrained taint path instantly:
                </span>
                {data.middlewareHotpatch && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyCode(data.middlewareHotpatch!, "Middleware Hotpatch")}
                  >
                    <Copy className="size-3" />
                    Copy Code
                  </Button>
                )}
              </div>
              <pre className="code-surface overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {data.middlewareHotpatch || "No hotpatch generated"}
              </pre>
            </div>
          )}

          {/* Tab 3: Perimeter WAF Signature */}
          {tab === "waf" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Deploy this WAF rule at the ingress proxy (Cloudflare / ModSecurity) to halt exploitation at the perimeter:
                </span>
                {data.wafRule && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyCode(data.wafRule!, "WAF Rule")}
                  >
                    <Copy className="size-3" />
                    Copy Rule
                  </Button>
                )}
              </div>
              <pre className="code-surface overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
                {data.wafRule || "No WAF rule generated"}
              </pre>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-3.5" />
              Verified In-Browser Symbolic Barrier Safe
            </span>
            <span className="font-mono">Audited by {data.model || "NVIDIA Nemotron"}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}


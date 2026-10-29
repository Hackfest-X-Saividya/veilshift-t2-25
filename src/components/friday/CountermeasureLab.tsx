import { useMemo, useState } from "react";
import { FlaskConical, ShieldCheck, ShieldX, Lock, ArrowRight, Play, CheckCircle2, AlertTriangle, Cpu, Terminal, Sparkles, Layers } from "lucide-react";
import { Panel } from "@/components/friday/ui";
import { DEFENSES, PROBES, simulate } from "@/lib/friday/countermeasure";
import type { Category } from "@/lib/friday/types";
import { cn } from "@/lib/utils";

export function CountermeasureLab({ category }: { category: Category }) {
  const probes = PROBES[category];
  const defenses = DEFENSES[category];
  const [input, setInput] = useState(probes[1]?.value ?? "");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [simulating, setSimulating] = useState(false);

  const r = useMemo(() => simulate(category, input, active), [category, input, active]);
  const toggle = (id: string) => setActive((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const activeProbe = probes.find((p) => p.value === input);

  const handleSimulatePulse = () => {
    setSimulating(true);
    setTimeout(() => setSimulating(false), 350);
  };

  const isBreached = r.outcome === "breached";
  const isContained = r.outcome === "contained";

  return (
    <Panel
      className="mt-4"
      title={
        <span className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          Interactive Vulnerability Simulator & Countermeasure Lab
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Cpu className="size-3" />
            Symbolic AST Engine · In-Browser Safe
          </span>
        </div>
      }
    >
      <div className="text-xs text-muted-foreground">
        Live-test attack probes through the simulated application pipeline. Toggle defenses on or off to inspect real-time payload transformation, AST execution, and barrier outcomes.
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-12">
        {/* Left Column: Attack Probes & Defenses (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Probe Selection */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-foreground">1. Select or craft attack probe</span>
              {activeProbe?.technique && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  {activeProbe.technique}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {probes.map((p) => (
                <button
                  key={p.id}
                  title={p.intent}
                  onClick={() => { setInput(p.value); handleSimulatePulse(); }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    input === p.value
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Raw input payload:</span>
                <span className="font-mono text-[10px]">{input.length} chars</span>
              </div>
              <input
                aria-label="Probe value"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 300))}
                className="code-surface w-full rounded-md border border-border px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none"
                placeholder="Type custom probe payload..."
              />
              {activeProbe && (
                <p className="mt-1 text-[11px] text-muted-foreground italic">
                  Intent: {activeProbe.intent}
                </p>
              )}
            </div>
          </div>

          {/* Defense Controls */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-foreground">2. Active Defenses & Mitigations</span>
              <span className="font-mono text-[10px] text-muted-foreground">{active.size} of {defenses.length} enabled</span>
            </div>

            <div className="space-y-2">
              {defenses.map((d) => {
                const isEnabled = active.has(d.id);
                return (
                  <label
                    key={d.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-all text-xs",
                      isEnabled
                        ? "border-emerald-600/50 bg-emerald-500/10 dark:bg-emerald-950/20 shadow-xs"
                        : "border-border bg-background hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                      checked={isEnabled}
                      onChange={() => { toggle(d.id); handleSimulatePulse(); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn("font-semibold text-xs", isEnabled ? "text-emerald-800 dark:text-emerald-300" : "text-foreground")}>
                          {d.label}
                        </span>
                        {isEnabled && <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">Active</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{d.description}</p>
                      <pre className="mt-1.5 overflow-x-auto rounded border border-border/60 bg-muted/40 p-1 font-mono text-[10px] text-muted-foreground">
                        {d.codeSnippet}
                      </pre>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Flow, Sink Output & Analysis (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Interactive Pipeline Visualizer */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="eyebrow flex items-center gap-1.5">
                <Layers className="size-3" />
                Pipeline Execution Trace
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                isBreached ? "bg-red-500/15 text-red-700 dark:text-red-400" : isContained ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
              )}>
                {isBreached ? "Vulnerable" : isContained ? "Protected" : "Benign"}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {r.stages.map((st, i) => (
                <div
                  key={st.name}
                  className={cn(
                    "flex flex-col justify-between rounded-md border p-2.5 text-xs transition-all",
                    st.status === "breached"
                      ? "border-red-500/50 bg-red-500/10 text-red-900 dark:text-red-200"
                      : st.status === "blocked"
                      ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium"
                      : "border-border bg-muted/20 text-foreground",
                    simulating && "scale-[0.98]"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                    <span>{i + 1}. {st.name}</span>
                    {st.status === "breached" ? (
                      <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                    ) : st.status === "blocked" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="size-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <p className="text-[10.5px] opacity-80 leading-tight">{st.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Real-Time Sink Inspection */}
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow flex items-center gap-1.5">
                <Terminal className="size-3" />
                Target Sink Environment (Execution Payload)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Live Buffer</span>
            </div>

            <pre className={cn(
              "code-surface overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-[11.5px] leading-relaxed transition-all",
              isBreached ? "border-red-500/40 bg-red-500/5 text-foreground" : "border-border"
            )}>
              {r.rendered}
            </pre>
          </div>

          {/* Outcome & Impact Report */}
          <div
            className={cn(
              "rounded-lg border p-4 text-xs transition-all",
              isBreached
                ? "border-red-500/50 bg-red-500/10 text-red-950 dark:text-red-100"
                : isContained
                ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                : "border-border bg-muted/30 text-foreground"
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {isBreached ? (
                <ShieldX className="size-4.5 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <ShieldCheck className={cn("size-4.5 shrink-0", isContained ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
              )}
              <span>
                {isBreached
                  ? "BREACH DETECTED — Payload altered execution semantics"
                  : isContained
                  ? `CONTAINED — Neutralized by ${r.stoppedBy}`
                  : "BENIGN EXECUTION — No malicious semantics detected"}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed opacity-90">
              <strong className="font-semibold">Analysis: </strong>
              {r.narrative}
            </p>

            <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 flex items-start gap-1.5 text-[11px] leading-relaxed">
              <strong className="font-semibold shrink-0">Impact:</strong>
              <span className="opacity-85">{r.impact}</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

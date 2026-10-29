import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/friday/ui";
import { AI_CATEGORIES, AI_FRAMEWORKS, generateRemediation } from "@/lib/ai-remediation.functions";
import type { Category } from "@/lib/friday/types";

type Fw = (typeof AI_FRAMEWORKS)[number];

export function AiRemediation({
  category,
  frameworks,
  findingContext,
}: {
  category: Category;
  frameworks: string[];
  findingContext?: {
    ruleId?: string;
    file?: string;
    line?: number;
    title?: string;
    sinkCode?: string;
    sourceDesc?: string;
    missingControl?: string;
  };
}) {
  const guess =
    AI_FRAMEWORKS.find((x) =>
      frameworks.some((f) => f.toLowerCase() === x.toLowerCase())
    ) ?? (findingContext?.file?.endsWith(".tsx") || findingContext?.file?.endsWith(".jsx") ? "React" : findingContext?.file?.endsWith(".py") ? "Flask" : "Plain Python");

  const defaultNote = findingContext
    ? [
        findingContext.title ? `Rule: ${findingContext.title}` : "",
        findingContext.file ? `File: ${findingContext.file}:${findingContext.line}` : "",
        findingContext.sinkCode ? `Sink: ${findingContext.sinkCode}` : "",
        findingContext.missingControl ? `Missing: ${findingContext.missingControl}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 300)
    : "";

  const [cat, setCat] = useState<Category>(category);
  const [fw, setFw] = useState<Fw>(guess);
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text?: string; reasoning?: string; model?: string; error?: string } | null>(null);
  const gen = useServerFn(generateRemediation);

  const run = async () => {
    setBusy(true); setOut(null);
    try { setOut(await gen({ data: { category: cat, framework: fw, note } })); }
    catch (e) { setOut({ error: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const sel = "h-8 rounded-md border bg-background px-2 text-sm";
  return (
    <Panel title="AI-tailored remediation" className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs">
        <p className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-success" />
          Only vulnerability type, framework and optional notes are transmitted. Scanned code stays local in-browser.
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-400">
          <Cpu className="size-3 text-emerald-400" />
          NVIDIA Nemotron-3.5-Super-VL
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs"><div className="eyebrow mb-1">Vulnerability type</div>
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {Object.entries(AI_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="text-xs"><div className="eyebrow mb-1">Framework</div>
          <select className={sel} value={fw} onChange={(e) => setFw(e.target.value as Fw)}>
            {AI_FRAMEWORKS.map((x) => <option key={x}>{x}</option>)}
          </select></label>
        <label className="min-w-56 flex-1 text-xs"><div className="eyebrow mb-1">Context (optional, no code)</div>
          <input className={sel + " w-full"} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. using parameterised queries or DOMPurify" /></label>
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-emerald-400" />}
          Generate guidance
        </Button>
      </div>

      {out?.error && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm">{out.error}</p>}

      {out?.text && (
        <div className="code-surface mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-xs leading-relaxed">
          {out.text}
        </div>
      )}

      {out?.text && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>AI-generated remediation guidance for standard secure design patterns. Always verify against your code.</span>
          <span className="font-mono text-[11px] text-muted-foreground">Provider: NVIDIA Integrate API</span>
        </div>
      )}
    </Panel>
  );
}

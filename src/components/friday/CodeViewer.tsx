import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getScanFiles } from "@/lib/friday/store";
import type { FileEntry } from "@/lib/friday/types";

const TOKEN = /(#.*$|\/\/.*$|\/\*[\s\S]*?\*\/)|([rbfuRBFU]{0,2}(?:"""|'''|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?))|(@[\w.]+)|\b(def|class|return|if|elif|else|for|while|in|import|from|as|with|try|except|finally|raise|not|and|or|is|None|True|False|async|await|lambda|pass|break|continue|yield|global|const|let|var|function|type|interface|export|default|extends|implements|new|this|typeof|instanceof|void|null|undefined|true|false)\b|\b(\d+(?:\.\d+)?)\b|(\b[A-Za-z_$][\w$]*(?=\s*[\(<]))/g;

function highlight(line: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let k = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const cls = m[1] ? "text-muted-foreground italic" : m[2] ? "text-code-str" : m[3] ? "text-code-dec" : m[4] ? "text-code-kw" : m[5] ? "text-code-num" : "text-code-fn";
    out.push(<span key={k++} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
    if (m[0].length === 0) TOKEN.lastIndex++;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function useScanFiles(scanId?: string) {
  const [files, setFiles] = useState<FileEntry[] | null | undefined>(undefined);
  useEffect(() => {
    if (!scanId) return;
    let live = true;
    setFiles(undefined);
    getScanFiles(scanId).then((f) => live && setFiles(f ?? null)).catch(() => live && setFiles(null));
    return () => { live = false; };
  }, [scanId]);
  return files;
}

export interface LineMarker { line: number; label: string; tone: "sink" | "source" | "other" }

export function CodeViewer({ content, path, focusLine, highlightLines = [], markers = [], context, onLineClick, className }: {
  content: string;
  path: string;
  focusLine?: number;
  highlightLines?: number[];
  markers?: LineMarker[];
  context?: number;
  onLineClick?: (line: number) => void;
  className?: string;
}) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const ref = useRef<HTMLDivElement>(null);
  const start = context && focusLine ? Math.max(1, focusLine - context) : 1;
  const end = context && focusLine ? Math.min(lines.length, focusLine + context) : lines.length;
  const hl = new Set(highlightLines);
  useEffect(() => {
    if (!focusLine || context) return;
    const el = ref.current?.querySelector(`[data-line="${focusLine}"]`) as HTMLElement | null;
    if (el && ref.current) ref.current.scrollTo({ top: el.offsetTop - ref.current.clientHeight / 3, behavior: "smooth" });
  }, [focusLine, context, content]);
  return (
    <div className={cn("overflow-hidden rounded-md border code-surface", className)}>
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="truncate font-mono text-xs text-muted-foreground">{path}</span>
        {focusLine && <span className="font-mono text-[11px] text-muted-foreground">L{focusLine}</span>}
      </div>
      <div ref={ref} className={cn("relative overflow-auto font-mono text-[12.5px] leading-[1.6]", !context && "max-h-[520px]")}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.slice(start - 1, end).map((l, i) => {
              const n = start + i;
              const mk = markers.filter((m) => m.line === n);
              const isFocus = n === focusLine;
              return (
                <tr key={n} data-line={n} onClick={onLineClick ? () => onLineClick(n) : undefined} className={cn(hl.has(n) && "bg-code-hl", isFocus && "outline outline-1 -outline-offset-1 outline-sev-critical/50", onLineClick && "cursor-pointer hover:bg-muted/40")}>
                  <td className={cn("w-10 select-none border-r pr-2 text-right align-top text-muted-foreground/60", isFocus && "text-sev-critical")}>{n}</td>
                  <td className="whitespace-pre pl-3 pr-4">
                    {highlight(l)}
                    {mk.map((m, j) => (
                      <span key={j} className={cn("ml-3 rounded-sm px-1 py-px font-sans text-[10px] font-medium", m.tone === "sink" ? "bg-sev-critical/15 text-sev-critical" : m.tone === "source" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{m.label}</span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { compareScans } from "./compare";
import { remediationFor } from "./remediation";
import type { DBState } from "./store";
import { CATEGORY_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, type ScanRecord } from "./types";

export const DISCLAIMER = "Static-analysis findings are potential vulnerabilities derived by reading source code without executing it. Every finding requires human validation before it is treated as a confirmed, exploitable issue.";

export function buildReport(db: DBState, scan: ScanRecord) {
  const project = db.projects.find((p) => p.id === scan.projectId);
  const prev = scan.previousScanId ? db.scans.find((s) => s.id === scan.previousScanId) : undefined;
  const cmp = prev ? compareScans(prev, scan) : null;
  return {
    generatedAt: new Date().toISOString(),
    tool: "FRIDAY local rule engine (in-browser)",
    project: { name: project?.name, isDemo: scan.isDemo, frameworks: scan.frameworks },
    scan: { id: scan.id, startedAt: new Date(scan.startedAt).toISOString(), durationMs: scan.finishedAt - scan.startedAt, status: scan.status, filesAnalyzed: scan.filesAnalyzed, filesSkipped: scan.filesSkipped, functionsAnalyzed: scan.functionsAnalyzed, routesFound: scan.routesFound, warnings: scan.warnings },
    scope: {
      categories: Object.values(CATEGORY_LABEL),
      limitations: [
        "Python only; Flask and FastAPI route patterns are recognized.",
        "Flow-insensitive intra-function taint tracking with bounded inter-procedural analysis.",
        "Middleware, gateways, runtime config and database permissions are not observed.",
        "No machine-learning model is configured; all findings come from deterministic rules.",
      ],
    },
    summary: {
      bySeverity: Object.fromEntries(SEVERITY_ORDER.map((s) => [SEVERITY_LABEL[s], scan.findings.filter((f) => f.severity === s).length])),
      byCategory: Object.fromEntries(Object.entries(CATEGORY_LABEL).map(([k, v]) => [v, scan.findings.filter((f) => f.category === k).length])),
    },
    findings: scan.findings.map((f) => {
      const issue = db.issues[`${scan.projectId}::${f.fingerprint}`];
      const rem = remediationFor(f);
      return {
        id: f.fingerprint, rule: f.ruleId, title: f.title, category: CATEGORY_LABEL[f.category], severity: SEVERITY_LABEL[f.severity], score: f.score, confidence: f.confidence,
        location: `${f.file}:${f.line}`, function: f.fn, route: f.route, reachability: f.reachability, evidence: f.evidence, statement: f.sinkCode,
        status: issue?.status, reviewNotes: issue?.history.map((h) => `${new Date(h.at).toISOString()} ${h.status}${h.note ? ` — ${h.note}` : ""}`),
        explanation: f.explanation, path: f.steps, missingControl: f.missingControl, limitations: f.limitations,
        remediation: { summary: rem.summary, steps: rem.steps, example: rem.after, review: rem.review },
      };
    }),
    safePatterns: scan.safe,
    comparison: cmp ? { previousScan: prev!.id, counts: cmp.counts, rows: cmp.rows.map((r) => ({ kind: r.kind, title: (r.after ?? r.before)!.title, note: r.note })) } : null,
    disclaimer: DISCLAIMER,
  };
}

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPdf(report: ReturnType<typeof buildReport>, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth() - 80;
  let y = 50;
  const ensure = (h: number) => { if (y + h > 800) { doc.addPage(); y = 50; } };
  const text = (s: string, size = 10, style: "normal" | "bold" = "normal", font = "helvetica") => {
    doc.setFont(font, style); doc.setFontSize(size);
    const lines = doc.splitTextToSize(s, W) as string[];
    lines.forEach((l) => { ensure(size + 4); doc.text(l, 40, y); y += size + 4; });
  };
  const gap = (n = 8) => { y += n; };
  text("FRIDAY Security Report", 18, "bold");
  text(`${report.project.name}${report.project.isDemo ? " (demo data)" : ""} · scan ${report.scan.id} · ${report.scan.startedAt}`, 9);
  gap();
  text("Scan summary", 13, "bold");
  text(`Status: ${report.scan.status} · ${report.scan.filesAnalyzed} files, ${report.scan.functionsAnalyzed} functions, ${report.scan.routesFound} routes · ${report.scan.durationMs} ms`);
  text(`By severity: ${Object.entries(report.summary.bySeverity).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  text(`By category: ${Object.entries(report.summary.byCategory).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  gap();
  text("Scope and limitations", 13, "bold");
  report.scope.limitations.forEach((l) => text(`• ${l}`));
  if (report.scan.warnings.length) report.scan.warnings.forEach((w) => text(`⚠ ${w}`, 9));
  gap();
  if (report.comparison) {
    text("Comparison with previous scan", 13, "bold");
    text(Object.entries(report.comparison.counts).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · "));
    report.comparison.rows.forEach((r) => text(`• [${r.kind.replace(/_/g, " ")}] ${r.title} — ${r.note}`, 9));
    gap();
  }
  text(`Findings (${report.findings.length})`, 13, "bold");
  report.findings.forEach((f, i) => {
    gap(6);
    text(`${i + 1}. [${f.severity}] ${f.title}`, 11, "bold");
    text(`${f.rule} · ${f.category} · confidence ${Math.round(f.confidence * 100)}% · ${f.location} · ${f.route ?? "no route"} · status ${f.status ?? "open"}`, 9);
    text(f.explanation, 9);
    text("Statement:", 9, "bold"); text(f.statement, 8, "normal", "courier");
    text("Source-to-sink path:", 9, "bold"); f.path.forEach((s, j) => text(`${j + 1}. ${s}`, 9));
    text(`Missing control: ${f.missingControl}`, 9);
    text(`Remediation: ${f.remediation.summary}`, 9);
    text(f.remediation.example, 8, "normal", "courier");
    text(`Developer review: ${f.remediation.review}`, 9);
    if (f.reviewNotes?.length) { text("Review notes:", 9, "bold"); f.reviewNotes.forEach((n) => text(n, 8)); }
  });
  if (!report.findings.length) text("No findings were detected in this scan.");
  gap();
  text("Disclaimer", 13, "bold");
  text(report.disclaimer, 9);
  doc.save(filename);
}

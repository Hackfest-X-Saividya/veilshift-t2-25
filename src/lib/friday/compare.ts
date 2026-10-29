import type { Finding, ScanRecord } from "./types";

export type CompareKind = "new" | "still_present" | "verified_fixed" | "not_observed" | "changed";

export interface CompareRow {
  kind: CompareKind;
  before?: Finding;
  after?: Finding;
  note: string;
}

export interface Comparison {
  previous: ScanRecord;
  current: ScanRecord;
  rows: CompareRow[];
  counts: Record<CompareKind, number>;
}

const softKey = (f: Finding) => `${f.category}|${f.file}|${f.fn}|${f.sourceDesc}`;

/**
 * Compare two scans of the same project. Exact matches use the stable
 * fingerprint (category, rule, file, function, normalized sink, source).
 * A finding that disappeared is only "verified fixed" when the same file
 * and function were analysed again without parse warnings.
 */
export function compareScans(previous: ScanRecord, current: ScanRecord): Comparison {
  const rows: CompareRow[] = [];
  const curBy = new Map(current.findings.map((f) => [f.fingerprint, f]));
  const curSoft = new Map(current.findings.map((f) => [softKey(f), f]));
  const used = new Set<string>();

  for (const b of previous.findings) {
    let a = curBy.get(b.fingerprint);
    let soft = false;
    if (!a) {
      const s = curSoft.get(softKey(b));
      if (s && !used.has(s.fingerprint) && !previous.findings.some((p) => p.fingerprint === s.fingerprint)) { a = s; soft = true; }
    }
    if (a) {
      used.add(a.fingerprint);
      const sevChanged = a.severity !== b.severity;
      const confChanged = Math.abs(a.confidence - b.confidence) >= 0.05;
      const pathChanged = a.nodes.map((n) => n.kind + n.label).join(">") !== b.nodes.map((n) => n.kind + n.label).join(">");
      if (sevChanged || confChanged || soft || pathChanged) {
        rows.push({ kind: "changed", before: b, after: a, note: [sevChanged && `Severity ${b.severity} → ${a.severity}`, confChanged && `Confidence ${Math.round(b.confidence * 100)}% → ${Math.round(a.confidence * 100)}%`, (soft || pathChanged) && "Source-to-sink path changed but the risk remains"].filter(Boolean).join(" · ") });
      } else rows.push({ kind: "still_present", before: b, after: a, note: "The same risky path is still detected." });
      continue;
    }
    const fileFns = current.inventory[b.file];
    const fileWarn = current.warnings.some((w) => w.startsWith(b.file + ":"));
    const safeHere = current.safe.find((s) => s.file === b.file && s.fn === b.fn && s.category === b.category);
    if (!fileFns) rows.push({ kind: "not_observed", before: b, note: `${b.file} is not part of the new scan, so the fix cannot be verified.` });
    else if (fileWarn) rows.push({ kind: "not_observed", before: b, note: `${b.file} produced analysis warnings in the new scan; FRIDAY cannot reliably confirm the path is gone.` });
    else if (!fileFns.includes(b.fn)) rows.push({ kind: "not_observed", before: b, note: `Function ${b.fn}() no longer exists in ${b.file}; the code moved or was removed. Review manually.` });
    else rows.push({ kind: "verified_fixed", before: b, note: safeHere ? `Path no longer detected. ${safeHere.description} (line ${safeHere.line}).` : `${b.fn}() was re-analysed and the source-to-sink path is no longer present.` });
  }
  for (const a of current.findings) if (!used.has(a.fingerprint) && !previous.findings.some((b) => b.fingerprint === a.fingerprint)) rows.push({ kind: "new", after: a, note: "Introduced since the previous scan." });

  const counts = { new: 0, still_present: 0, verified_fixed: 0, not_observed: 0, changed: 0 } as Record<CompareKind, number>;
  rows.forEach((r) => counts[r.kind]++);
  return { previous, current, rows, counts };
}

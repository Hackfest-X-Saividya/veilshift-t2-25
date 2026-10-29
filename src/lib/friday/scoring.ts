import type { Category, EvidenceStrength, Reachability, ScoreFactor, Severity } from "./types";

export interface ScoreInput {
  category: Category;
  ruleId: string;
  publicRoute: boolean;
  authenticated: boolean;
  reachability: Reachability;
  evidence: EvidenceStrength;
  shellSink: boolean;
  multiStatement: boolean;
  sensitiveAsset: boolean;
  weakSanitizer?: string;
  interprocedural: number;
  origin: string;
  globalAuthHook?: boolean;
}

/**
 * Transparent prioritization. The score is a ranking aid on a 0–10 scale,
 * NOT a probability of exploitation. Every contribution is reported.
 */
export function scoreFinding(i: ScoreInput): { score: number; severity: Severity; confidence: number; factors: ScoreFactor[] } {
  const f: ScoreFactor[] = [];
  const base = i.category === "cmdi" ? 8 : i.category === "sqli" ? 7 : i.ruleId === "FRI-AC-001" ? 6 : 4.5;
  f.push({ label: i.category === "cmdi" ? "Category: command execution (base)" : i.category === "sqli" ? "Category: SQL injection (base)" : i.ruleId === "FRI-AC-001" ? "Category: missing authorization (base)" : "Category: possible IDOR (base)", delta: base, kind: "base" });
  if (i.publicRoute) f.push({ label: "Reachable from a route with no authentication observed", delta: 1, kind: "increase" });
  else if (i.authenticated) f.push({ label: "Route requires an authenticated user", delta: -0.5, kind: "decrease" });
  if (i.reachability === "uncertain") f.push({ label: "No confirmed route reaches this code", delta: -1, kind: "uncertain" });
  if (i.shellSink) f.push({ label: "Sink always invokes a shell / interpreter", delta: 0.5, kind: "increase" });
  if (i.multiStatement) f.push({ label: "executescript() allows stacked statements", delta: 0.5, kind: "increase" });
  if (i.sensitiveAsset) f.push({ label: "Affected asset looks sensitive", delta: 0.5, kind: "increase" });
  if (i.evidence === "strong") f.push({ label: "Strong static evidence: direct source-to-sink path", delta: 0.5, kind: "increase" });
  if (i.weakSanitizer) f.push({ label: `Partial control present (${i.weakSanitizer})`, delta: -1, kind: "uncertain" });
  if (i.globalAuthHook) f.push({ label: "Global auth hook may enforce access control", delta: -1, kind: "uncertain" });
  const score = Math.max(0, Math.min(10, f.reduce((s, x) => s + x.delta, 0)));
  const severity: Severity = score >= 8.5 ? "critical" : score >= 7 ? "high" : score >= 5 ? "medium" : score >= 3 ? "low" : "info";

  let confidence = i.category === "access" ? (i.ruleId === "FRI-AC-001" ? 0.6 : 0.45) : i.origin === "fastapi_param" ? 0.8 : 0.9;
  if (i.interprocedural > 0) confidence -= 0.05 * i.interprocedural;
  if (i.weakSanitizer) confidence -= 0.2;
  if (i.reachability === "uncertain") confidence -= 0.1;
  if (i.globalAuthHook) confidence -= 0.15;
  confidence = Math.round(Math.max(0.1, Math.min(0.97, confidence)) * 100) / 100;
  return { score: Math.round(score * 10) / 10, severity, confidence, factors: f };
}

export function confidenceLabel(c: number) {
  return c >= 0.8 ? "High" : c >= 0.55 ? "Medium" : "Low";
}

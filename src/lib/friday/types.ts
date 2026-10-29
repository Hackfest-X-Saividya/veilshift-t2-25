export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category = "sqli" | "cmdi" | "access";
export type Reachability = "reachable" | "uncertain";
export type EvidenceStrength = "strong" | "moderate" | "weak";
export type FindingStatus = "open" | "under_review" | "fixed" | "recurring";
export type Verification = "verified_fixed" | "not_observed" | "still_present" | "pending";

export type NodeKind =
  | "source"
  | "route"
  | "variable"
  | "transform"
  | "call"
  | "sanitizer"
  | "sink"
  | "asset"
  | "missing_check";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  detail?: string;
  file?: string;
  line?: number;
  fn?: string;
  /** true if this node is the reported vulnerable statement */
  vulnerable?: boolean;
  /** off-path informational nodes (safe handling) */
  offPath?: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
}

export interface ScoreFactor {
  label: string;
  delta: number;
  kind: "base" | "increase" | "decrease" | "uncertain";
}

export interface Finding {
  fingerprint: string;
  ruleId: string;
  category: Category;
  title: string;
  severity: Severity;
  score: number;
  confidence: number;
  file: string;
  line: number;
  fn: string;
  route?: string;
  reachability: Reachability;
  evidence: EvidenceStrength;
  sinkCode: string;
  sourceDesc: string;
  explanation: string;
  rationale: string;
  steps: string[];
  missingControl: string;
  limitations: string[];
  factors: ScoreFactor[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SafeObservation {
  file: string;
  line: number;
  fn: string;
  category: Category;
  description: string;
}

export interface FileEntry {
  path: string;
  content: string;
  size: number;
}

export interface SkippedEntry {
  path: string;
  reason: string;
}

export type ScanStatus =
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export interface ScanRecord {
  id: string;
  projectId: string;
  startedAt: number;
  finishedAt: number;
  status: ScanStatus;
  error?: string;
  filesAnalyzed: number;
  filesSkipped: number;
  frameworks: string[];
  warnings: string[];
  findings: Finding[];
  safe: SafeObservation[];
  functionsAnalyzed: number;
  routesFound: number;
  /** per-file list of function names successfully parsed (used for verification) */
  inventory: Record<string, string[]>;
  previousScanId?: string;
  isDemo: boolean;
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastScanAt?: number;
  latestScanId?: string;
  frameworks: string[];
  isDemo: boolean;
  fileCount: number;
}

export interface IssueRecord {
  key: string; // projectId::fingerprint
  projectId: string;
  fingerprint: string;
  status: FindingStatus;
  firstSeenScanId: string;
  lastSeenScanId: string;
  firstDetected: number;
  lastDetected: number;
  /** scan in which it was last absent after being present */
  verification?: Verification;
  verificationNote?: string;
  history: { at: number; status: FindingStatus; note?: string }[];
}

export interface Settings {
  workspaceName: string;
  theme: "dark" | "light";
  categories: Record<Category, boolean>;
  extraExclusions: string[];
  minConfidence: number;
  showNumericConfidence: boolean;
  retentionScansPerProject: number;
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Informational",
};
export const CATEGORY_LABEL: Record<Category, string> = {
  sqli: "SQL injection",
  cmdi: "Command injection",
  access: "Access control",
};
export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  under_review: "Under review",
  fixed: "Marked fixed",
  recurring: "Recurring",
};

import { useSyncExternalStore } from "react";
import { del, get, set } from "idb-keyval";
import { analyzeProject, ScanCancelled } from "./analyzer";
import { compareScans } from "./compare";
import type { Category, FileEntry, FindingStatus, IssueRecord, Project, ScanRecord, Settings } from "./types";

/**
 * All FRIDAY data lives in this browser's IndexedDB. Uploaded source code is
 * analysed in-page and never sent to a server.
 */

export interface DBState {
  projects: Project[];
  scans: ScanRecord[];
  issues: Record<string, IssueRecord>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  workspaceName: "Local workspace",
  theme: "dark",
  categories: { sqli: true, cmdi: true, access: true },
  extraExclusions: [],
  minConfidence: 0,
  showNumericConfidence: true,
  retentionScansPerProject: 20,
};

const KEY = "friday-db-v1";
const empty: DBState = { projects: [], scans: [], issues: {}, settings: DEFAULT_SETTINGS };

let state: DBState = empty;
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

async function persist() {
  try { await set(KEY, state); } catch (e) { console.error("FRIDAY: failed to persist", e); throw e; }
}

function commit(next: DBState) { state = next; emit(); return persist(); }

export function hydrate() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const saved = (await get(KEY)) as DBState | undefined;
        if (saved) state = { ...empty, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings, categories: { ...DEFAULT_SETTINGS.categories, ...saved.settings?.categories } } };
      } catch (e) { console.error("FRIDAY: storage unavailable", e); }
      hydrated = true;
      emit();
    })();
  }
  return hydrating;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useDB(): DBState & { ready: boolean } {
  const s = useSyncExternalStore(subscribe, () => state, () => empty);
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  return { ...s, ready };
}
export const getState = () => state;

export const issueKey = (projectId: string, fp: string) => `${projectId}::${fp}`;
const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 12);

/* ------------------------------ scans ------------------------------ */

export type Stage = "ready" | "uploading" | "preparing" | "analyzing" | "graph" | "ranking" | "completed" | "completed_with_warnings" | "failed" | "cancelled";

export interface Progress { stage: Stage; filesDone: number; filesTotal: number; findings: number; stageTimes: Partial<Record<Stage, number>> }

export interface RunScanInput {
  projectId?: string;
  name: string;
  files: FileEntry[];
  skipped: number;
  isDemo: boolean;
  label?: string;
  onProgress: (p: Progress) => void;
  isCancelled: () => boolean;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function runScan(input: RunScanInput): Promise<ScanRecord> {
  const startedAt = Date.now();
  const stageTimes: Partial<Record<Stage, number>> = {};
  const p: Progress = { stage: "preparing", filesDone: 0, filesTotal: input.files.length, findings: 0, stageTimes };
  const go = async (stage: Stage, patch: Partial<Progress> = {}) => {
    stageTimes[stage] = Date.now();
    Object.assign(p, patch, { stage });
    input.onProgress({ ...p, stageTimes: { ...stageTimes } });
    await tick();
  };
  await go("preparing");
  const s = state;
  let project = input.projectId ? s.projects.find((x) => x.id === input.projectId) : undefined;
  const previous = project?.latestScanId ? s.scans.find((x) => x.id === project!.latestScanId) : undefined;
  const scanId = uid();
  const projectId = project?.id ?? uid();

  try {
    await set(`files:${scanId}`, input.files);
    await go("analyzing");
    const result = await analyzeProject(input.files, s.settings.categories, {
      isCancelled: input.isCancelled,
      onStage: async (stage, info) => {
        if (stage === "analyzing") { p.filesDone = info.filesDone; input.onProgress({ ...p, stageTimes: { ...stageTimes } }); await tick(); }
        else await go(stage, { findings: info.findings });
      },
    });
    const status = result.warnings.length ? "completed_with_warnings" : "completed";
    const scan: ScanRecord = {
      id: scanId, projectId, startedAt, finishedAt: Date.now(), status, filesAnalyzed: input.files.length, filesSkipped: input.skipped,
      frameworks: result.frameworks, warnings: result.warnings, findings: result.findings, safe: result.safe,
      functionsAnalyzed: result.functionsAnalyzed, routesFound: result.routesFound, inventory: result.inventory,
      previousScanId: previous?.id, isDemo: input.isDemo, label: input.label,
    };
    if (!project) project = { id: projectId, name: input.name, createdAt: startedAt, frameworks: [], isDemo: input.isDemo, fileCount: 0 };
    const nextProject: Project = { ...project, lastScanAt: scan.finishedAt, latestScanId: scan.id, frameworks: result.frameworks, fileCount: input.files.length };
    const issues = { ...state.issues };
    const now = scan.finishedAt;
    for (const f of scan.findings) {
      const k = issueKey(projectId, f.fingerprint);
      const ex = issues[k];
      if (!ex) issues[k] = { key: k, projectId, fingerprint: f.fingerprint, status: "open", firstSeenScanId: scan.id, lastSeenScanId: scan.id, firstDetected: now, lastDetected: now, verification: "pending", history: [{ at: now, status: "open", note: "First detected" }] };
      else {
        const recurring = ex.status === "fixed";
        issues[k] = { ...ex, lastSeenScanId: scan.id, lastDetected: now, status: recurring ? "recurring" : ex.status, verification: "still_present", verificationNote: recurring ? "Detected again after being marked fixed." : "Still detected in the latest scan.", history: recurring ? [...ex.history, { at: now, status: "recurring", note: "Detected again by rescan" }] : ex.history };
      }
    }
    if (previous) {
      const cmp = compareScans(previous, scan);
      for (const row of cmp.rows) {
        if (!row.before || (row.kind !== "verified_fixed" && row.kind !== "not_observed")) continue;
        const k = issueKey(projectId, row.before.fingerprint);
        const ex = issues[k];
        if (!ex) continue;
        if (row.kind === "verified_fixed") issues[k] = { ...ex, status: "fixed", verification: "verified_fixed", verificationNote: row.note, history: [...ex.history, { at: now, status: "fixed", note: "Verified by rescan: path no longer present" }] };
        else issues[k] = { ...ex, verification: "not_observed", verificationNote: row.note };
      }
    }
    // retention
    let scans = [...state.scans, scan];
    const mine = scans.filter((x) => x.projectId === projectId).sort((a, b) => b.startedAt - a.startedAt);
    const drop = mine.slice(Math.max(1, state.settings.retentionScansPerProject)).map((x) => x.id);
    if (drop.length) { scans = scans.filter((x) => !drop.includes(x.id)); drop.forEach((id) => del(`files:${id}`)); }
    const projects = state.projects.some((x) => x.id === projectId) ? state.projects.map((x) => (x.id === projectId ? nextProject : x)) : [...state.projects, nextProject];
    await go("ranking", { findings: scan.findings.length });
    await commit({ ...state, projects, scans, issues });
    await go(status, { findings: scan.findings.length });
    return scan;
  } catch (e) {
    await del(`files:${scanId}`).catch(() => {});
    if (e instanceof ScanCancelled) { await go("cancelled"); throw e; }
    await go("failed");
    throw e;
  }
}

export const getScanFiles = (scanId: string) => get(`files:${scanId}`) as Promise<FileEntry[] | undefined>;

/* ----------------------------- mutations ---------------------------- */

export async function setIssueStatus(key: string, status: FindingStatus, note?: string) {
  const ex = state.issues[key];
  if (!ex) throw new Error("Finding not found");
  await commit({ ...state, issues: { ...state.issues, [key]: { ...ex, status, verification: status === "fixed" ? (ex.verification === "verified_fixed" ? ex.verification : "pending") : ex.verification, verificationNote: status === "fixed" && ex.verification !== "verified_fixed" ? "Marked fixed by a developer. Rescan to verify the path is gone." : ex.verificationNote, history: [...ex.history, { at: Date.now(), status, note }] } } });
}

export async function renameProject(id: string, name: string) {
  if (!name.trim()) throw new Error("Name cannot be empty");
  await commit({ ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) });
}

export async function deleteProject(id: string) {
  const scans = state.scans.filter((s) => s.projectId === id);
  await Promise.all(scans.map((s) => del(`files:${s.id}`)));
  const issues = Object.fromEntries(Object.entries(state.issues).filter(([, v]) => v.projectId !== id));
  await commit({ ...state, projects: state.projects.filter((p) => p.id !== id), scans: state.scans.filter((s) => s.projectId !== id), issues });
}

export async function deleteScan(id: string) {
  const scan = state.scans.find((s) => s.id === id);
  if (!scan) return;
  await del(`files:${id}`);
  const scans = state.scans.filter((s) => s.id !== id);
  const remaining = scans.filter((s) => s.projectId === scan.projectId).sort((a, b) => b.startedAt - a.startedAt);
  const projects = state.projects.map((p) => (p.id === scan.projectId ? { ...p, latestScanId: remaining[0]?.id, lastScanAt: remaining[0]?.finishedAt } : p));
  await commit({ ...state, scans, projects });
}

export async function clearAllData() {
  await Promise.all(state.scans.map((s) => del(`files:${s.id}`)));
  await commit({ ...empty, settings: state.settings });
}

export async function updateSettings(patch: Partial<Settings>) {
  await commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function toggleCategory(c: Category, on: boolean) {
  return updateSettings({ categories: { ...state.settings.categories, [c]: on } });
}

/* ----------------------------- selectors ---------------------------- */

export function findingFor(db: DBState, key: string, scanId?: string) {
  const issue = db.issues[key];
  if (!issue) return null;
  const scan = db.scans.find((s) => s.id === (scanId ?? issue.lastSeenScanId)) ?? db.scans.filter((s) => s.projectId === issue.projectId).sort((a, b) => b.startedAt - a.startedAt).find((s) => s.findings.some((f) => f.fingerprint === issue.fingerprint));
  const finding = scan?.findings.find((f) => f.fingerprint === issue.fingerprint);
  if (!scan || !finding) return null;
  return { issue, scan, finding, project: db.projects.find((p) => p.id === issue.projectId) };
}

export function allIssueRows(db: DBState) {
  return Object.values(db.issues).flatMap((issue) => {
    const r = findingFor(db, issue.key);
    if (!r) return [];
    const project = db.projects.find((p) => p.id === issue.projectId);
    const inLatest = project?.latestScanId === issue.lastSeenScanId;
    return [{ ...r, inLatest }];
  });
}
export type IssueRow = ReturnType<typeof allIssueRows>[number];

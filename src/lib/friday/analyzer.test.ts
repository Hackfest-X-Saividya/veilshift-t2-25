import { describe, expect, it } from "vitest";
import { analyzeProject } from "./analyzer";
import { compareScans } from "./compare";
import { demoPatched, demoVulnerable } from "./demo";
import { validateEntryPath } from "./ingest";
import type { ScanRecord } from "./types";

const all = { sqli: true, cmdi: true, access: true };
const asScan = (id: string, r: Awaited<ReturnType<typeof analyzeProject>>): ScanRecord => ({
  id, projectId: "p", startedAt: 0, finishedAt: 0, status: "completed", filesAnalyzed: 2, filesSkipped: 0,
  frameworks: r.frameworks, warnings: r.warnings, findings: r.findings, safe: r.safe, functionsAnalyzed: r.functionsAnalyzed,
  routesFound: r.routesFound, inventory: r.inventory, isDemo: true,
});

describe("FRIDAY analyzer on the demo project", () => {
  it("finds the four known issues in the vulnerable sample", async () => {
    const r = await analyzeProject(demoVulnerable(), all);
    const keys = r.findings.map((f) => `${f.category}:${f.fn}`).sort();
    expect(keys).toEqual(["access:get_invoice", "cmdi:ping_host", "cmdi:run_report", "sqli:search_users"]);
    expect(r.frameworks).toContain("Flask");
  });

  it("traces SQL injection from request.args to the users table", async () => {
    const r = await analyzeProject(demoVulnerable(), all);
    const f = r.findings.find((x) => x.category === "sqli")!;
    expect(f.line).toBe(20);
    expect(f.nodes[0].label).toBe("request.args['q']");
    expect(f.nodes.at(-1)!.label).toBe("Table users");
    expect(f.reachability).toBe("reachable");
  });

  it("follows the tainted value across the run_report helper", async () => {
    const r = await analyzeProject(demoVulnerable(), all);
    const f = r.findings.find((x) => x.fn === "run_report")!;
    expect(f.route).toBe("GET /api/reports/export");
    expect(f.nodes.some((n) => n.kind === "call")).toBe(true);
  });

  it("does not flag the parameterized find_customers query", async () => {
    const r = await analyzeProject(demoVulnerable(), all);
    expect(r.findings.some((f) => f.fn === "find_customers")).toBe(false);
    expect(r.safe.some((s) => s.fn === "find_customers")).toBe(true);
  });

  it("reports no findings for the patched sample", async () => {
    const r = await analyzeProject(demoPatched(), all);
    expect(r.findings).toEqual([]);
  });

  it("verifies all four fixes when comparing vulnerable vs patched", async () => {
    const a = asScan("a", await analyzeProject(demoVulnerable(), all));
    const b = asScan("b", await analyzeProject(demoPatched(), all));
    const c = compareScans(a, b);
    expect(c.counts.verified_fixed).toBe(4);
    expect(c.counts.new).toBe(0);
  });

  it("keeps a rescan of unchanged code as still present", async () => {
    const a = asScan("a", await analyzeProject(demoVulnerable(), all));
    const b = asScan("b", await analyzeProject(demoVulnerable(), all));
    expect(compareScans(a, b).counts.still_present).toBe(4);
  });

  it("respects disabled categories", async () => {
    const r = await analyzeProject(demoVulnerable(), { sqli: true, cmdi: false, access: false });
    expect(r.findings.map((f) => f.category)).toEqual(["sqli"]);
  });
});

describe("FastAPI and archive safety", () => {
  it("treats FastAPI query params as untrusted", async () => {
    const src = `from fastapi import FastAPI\nimport os\napp = FastAPI()\n\n@app.get("/run")\ndef run(cmd: str):\n    os.system("echo " + cmd)\n`;
    const r = await analyzeProject([{ path: "main.py", content: src, size: src.length }], all);
    expect(r.findings[0]?.category).toBe("cmdi");
  });

  it("rejects path traversal entries", () => {
    expect(validateEntryPath("../etc/passwd")).not.toBeNull();
    expect(validateEntryPath("/abs/file.py")).not.toBeNull();
    expect(validateEntryPath("src/app.py")).toBeNull();
  });
});

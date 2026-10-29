import { describe, it, expect } from "vitest";
import { analyzeWebFiles } from "./web-analyzer";

describe("Web Security Analyzer (TS, JS, React, HTML, CSS)", () => {
  it("detects React dangerouslySetInnerHTML without DOMPurify", () => {
    const files = [
      {
        path: "src/components/UserProfile.tsx",
        content: `
import React from 'react';

export function UserProfile({ bio }: { bio: string }) {
  return (
    <div className="profile">
      <div dangerouslySetInnerHTML={{ __html: bio }} />
    </div>
  );
}
        `,
        size: 200,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.frameworks.has("React")).toBe(true);
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].ruleId).toBe("REACT-XSS-001");
    expect(res.findings[0].severity).toBe("critical");
  });

  it("marks dangerouslySetInnerHTML as safe when sanitized with DOMPurify", () => {
    const files = [
      {
        path: "src/components/SafeProfile.tsx",
        content: `
import React from 'react';
import DOMPurify from 'dompurify';

export function SafeProfile({ bio }: { bio: string }) {
  const clean = DOMPurify.sanitize(bio);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
        `,
        size: 250,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.findings.length).toBe(0);
    expect(res.safe.length).toBe(1);
    expect(res.safe[0].description).toContain("DOMPurify");
  });

  it("detects Command Injection via child_process.exec in Node.js", () => {
    const files = [
      {
        path: "server/exec.ts",
        content: `
import { exec } from 'child_process';

export function pingHost(host: string) {
  exec(\`ping -c 1 \${host}\`, (err, stdout) => {
    console.log(stdout);
  });
}
        `,
        size: 180,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].ruleId).toBe("NODE-CMDI-004");
    expect(res.findings[0].category).toBe("cmdi");
  });

  it("detects SQL injection via template string concatenation in db.query", () => {
    const files = [
      {
        path: "server/db.js",
        content: `
async function getUser(id) {
  return await db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
}
        `,
        size: 140,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].ruleId).toBe("NODE-SQLI-005");
    expect(res.findings[0].category).toBe("sqli");
  });

  it("detects reverse tabnabbing in HTML and React links", () => {
    const files = [
      {
        path: "src/Footer.tsx",
        content: `
export function Footer() {
  return <a href="https://partner-portal.com" target="_blank">Partner Portal</a>;
}
        `,
        size: 120,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.findings.some((f) => f.ruleId === "WEB-REVERSE-TABNABBING-006")).toBe(true);
  });

  it("detects hardcoded private API keys in frontend code", () => {
    const files = [
      {
        path: "src/config/api.ts",
        content: `
export const clientConfig = {
  apiKey: "sk-proj-91028340192834019283401928340"
};
        `,
        size: 110,
      },
    ];

    const res = analyzeWebFiles(files);
    expect(res.findings.some((f) => f.ruleId === "WEB-LEAKED-SECRET-009")).toBe(true);
  });

  it("detects all vulnerabilities in demo-jury-vulnerabilities.tsx and builds flow graphs", () => {
    const fs = require("fs");
    const content = fs.readFileSync("demo-jury-vulnerabilities.tsx", "utf8");
    const res = analyzeWebFiles([{ path: "demo-jury-vulnerabilities.tsx", content, size: content.length }]);

    const ruleIds = new Set(res.findings.map((f) => f.ruleId));
    expect(ruleIds.has("WEB-LEAKED-SECRET-009")).toBe(true);
    expect(ruleIds.has("JS-CODE-EVAL-003")).toBe(true);
    expect(ruleIds.has("REACT-XSS-001")).toBe(true);
    expect(ruleIds.has("WEB-REVERSE-TABNABBING-006")).toBe(true);
    expect(ruleIds.has("WEB-JS-URI-XSS-007")).toBe(true);
    expect(ruleIds.has("NODE-CMDI-004")).toBe(true);
    expect(ruleIds.has("NODE-SQLI-005")).toBe(true);
    expect(res.findings.length).toBeGreaterThanOrEqual(7);

    // Verify graph nodes are created for each finding
    for (const f of res.findings) {
      expect(f.nodes.length).toBeGreaterThanOrEqual(3);
      expect(f.edges.length).toBeGreaterThanOrEqual(2);
    }
  });
});


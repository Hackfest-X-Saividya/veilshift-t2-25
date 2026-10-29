import type { FileEntry } from "./types";

/**
 * "Northwind Notes" — a deliberately vulnerable Flask app used as FRIDAY's
 * demonstration project. It is analysed by the real scanner; nothing here is
 * a precomputed result.
 */
const APP_VULN = `from flask import Flask, request, jsonify, abort
from flask_login import login_required, current_user
import sqlite3
import subprocess

from services import run_report, find_customers

app = Flask(__name__)


def get_db():
    return sqlite3.connect("northwind.db")


@app.route("/api/users/search")
def search_users():
    term = request.args.get("q", "")
    db = get_db()
    query = f"SELECT id, email, role FROM users WHERE email LIKE '%{term}%'"
    rows = db.execute(query).fetchall()
    return jsonify(rows)


@app.route("/api/tools/ping", methods=["POST"])
def ping_host():
    host = request.form["host"]
    output = subprocess.check_output("ping -c 1 " + host, shell=True)
    return output


@app.route("/api/invoices/<invoice_id>")
@login_required
def get_invoice(invoice_id):
    db = get_db()
    invoice = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    if invoice is None:
        abort(404)
    return jsonify(invoice)


@app.route("/api/reports/export")
def export_report():
    name = request.args.get("name")
    return run_report(name)


@app.route("/api/customers")
def customers():
    region = request.args.get("region", "EU")
    return jsonify(find_customers(region))
`;

const SERVICES_VULN = `import os
import sqlite3


def run_report(report_name):
    target = "/var/reports/" + report_name
    os.system(f"tar -czf /tmp/export.tgz {target}")
    return "queued"


def find_customers(region):
    db = sqlite3.connect("northwind.db")
    cur = db.cursor()
    cur.execute("SELECT name, region FROM customers WHERE region = ?", (region,))
    return cur.fetchall()
`;

const APP_PATCHED = `from flask import Flask, request, jsonify, abort
from flask_login import login_required, current_user
import sqlite3
import subprocess

from services import run_report, find_customers

app = Flask(__name__)


def get_db():
    return sqlite3.connect("northwind.db")


@app.route("/api/users/search")
def search_users():
    term = request.args.get("q", "")
    db = get_db()
    rows = db.execute(
        "SELECT id, email, role FROM users WHERE email LIKE ?",
        (f"%{term}%",),
    ).fetchall()
    return jsonify(rows)


@app.route("/api/tools/ping", methods=["POST"])
def ping_host():
    host = request.form["host"]
    output = subprocess.check_output(["ping", "-c", "1", host])
    return output


@app.route("/api/invoices/<invoice_id>")
@login_required
def get_invoice(invoice_id):
    db = get_db()
    invoice = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    if invoice is None:
        abort(404)
    if invoice["owner_id"] != current_user.id:
        abort(403)
    return jsonify(invoice)


@app.route("/api/reports/export")
def export_report():
    name = request.args.get("name")
    return run_report(name)


@app.route("/api/customers")
def customers():
    region = request.args.get("region", "EU")
    return jsonify(find_customers(region))
`;

const SERVICES_PATCHED = `import os
import shlex
import sqlite3


def run_report(report_name):
    target = shlex.quote("/var/reports/" + report_name)
    os.system(f"tar -czf /tmp/export.tgz {target}")
    return "queued"


def find_customers(region):
    db = sqlite3.connect("northwind.db")
    cur = db.cursor()
    cur.execute("SELECT name, region FROM customers WHERE region = ?", (region,))
    return cur.fetchall()
`;

const README = `# PayPortal Enterprise & SecStore API
Production benchmark target repository for SAST AST security analysis.
`;

const enc = (path: string, content: string): FileEntry => ({ path, content, size: new TextEncoder().encode(content).length });

const JURY_VULN_FILE = `/**
 * PayPortal Enterprise - Core Security Benchmark Component
 * 
 * Target security inspection file featuring realistic production patterns:
 *  1. React JSX: Cross-Site Scripting (XSS) via dangerouslySetInnerHTML
 *  2. React/DOM: Reverse Tabnabbing via unvalidated target="_blank"
 *  3. React/DOM: XSS via javascript: URI pseudo-protocol
 *  4. Frontend Security: Hardcoded private production API keys & JWT secrets
 *  5. Node.js Backend: Remote Command Execution via child_process.exec()
 *  6. Node.js / Database: Raw SQL Injection via string interpolation
 *  7. Client Scripting: Insecure dynamic code execution via eval()
 */

import React, { useState, useEffect } from 'react';
import { exec } from 'child_process';

// 1. Hardcoded Secrets / Private API Keys in Frontend Bundle
export const PRODUCTION_CONFIG = {
  appName: "PayPortal Enterprise",
  environment: "production",
  apiKey: "sk-live-9928340192834019283401928340a1b2c3",
  jwtSecret: "super-secret-jwt-signing-key-production-998822"
};

// 2 & 3: React Component with XSS & Reverse Tabnabbing
export function UserProfileCard({ userBio, websiteUrl }: { userBio: string; websiteUrl: string }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // 4: Insecure dynamic script execution
    const rawData = window.sessionStorage.getItem("cached_prefs") || '({})';
    const parsed = eval(\`(\${rawData})\`);
    setProfile(parsed);
  }, []);

  return (
    <div className="user-profile-card">
      <h2>User Profile</h2>

      {/* 5: React XSS via dangerouslySetInnerHTML without DOMPurify */}
      <div 
        className="bio-section"
        dangerouslySetInnerHTML={{ __html: userBio }} 
      />

      {/* 6: Reverse Tabnabbing (missing rel="noopener noreferrer") */}
      <div className="links">
        <a href={websiteUrl} target="_blank">
          Visit Personal Website
        </a>

        {/* 7: javascript: pseudo-protocol navigation XSS */}
        <a href="javascript:alert('Session Hijacked: ' + document.cookie)">
          Export Diagnostic Logs
        </a>
      </div>
    </div>
  );
}

// 8: Node.js Backend Command Injection
export function runSystemDiagnostics(networkHost: string) {
  // Vulnerable shell interpolation: attacker passes "; rm -rf /" or "| cat /etc/passwd"
  exec(\`ping -c 2 \${networkHost}\`, (error, stdout, stderr) => {
    if (error) {
      console.error(\`Diagnostic execution error: \${error.message}\`);
      return;
    }
    console.log(\`Results: \${stdout}\`);
  });
}

// 9: Node.js / Express SQL Injection
export async function authenticateCustomer(dbClient: any, userEmail: string) {
  // Direct string interpolation into SQL query engine allows ' OR '1'='1 SQLi bypass
  const query = \`SELECT id, email, role, password_hash FROM customers WHERE email = '\${userEmail}'\`;
  const result = await dbClient.query(query);
  return result.rows;
}
`;

const JURY_PATCHED_FILE = `/**
 * PayPortal Enterprise - Remediated Production Code (Verified Fixed)
 */

import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { execFile } from 'child_process';

// 1. Secrets moved to server-side environment variables
export const PRODUCTION_CONFIG = {
  appName: "PayPortal Enterprise",
  environment: "production",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/v1"
};

// 2 & 3: Remediated React Component
export function UserProfileCard({ userBio, websiteUrl }: { userBio: string; websiteUrl: string }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // 4: Safe JSON parsing
    const rawData = window.sessionStorage.getItem("cached_prefs") || '{}';
    try {
      const parsed = JSON.parse(rawData);
      setProfile(parsed);
    } catch (err) {
      console.error("Failed to parse cached preferences", err);
    }
  }, []);

  // 5: Sanitize HTML using DOMPurify
  const cleanBio = DOMPurify.sanitize(userBio);

  return (
    <div className="user-profile-card">
      <h2>User Profile</h2>

      <div 
        className="bio-section"
        dangerouslySetInnerHTML={{ __html: cleanBio }} 
      />

      {/* 6: Reverse Tabnabbing closed with rel="noopener noreferrer" */}
      <div className="links">
        <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
          Visit Personal Website
        </a>

        {/* 7: Event handler instead of javascript: URI */}
        <button 
          type="button" 
          onClick={() => console.log('Diagnostic exported safely')}
          className="btn-export"
        >
          Export Diagnostic Logs
        </button>
      </div>
    </div>
  );
}

// 8: Safe execution without subshell via execFile
export function runSystemDiagnostics(networkHost: string) {
  if (!/^[a-zA-Z0-9.-]+$/.test(networkHost)) {
    throw new Error("Invalid network host identifier");
  }
  execFile("ping", ["-c", "2", networkHost], (error, stdout) => {
    if (error) {
      console.error(\`Diagnostic execution error: \${error.message}\`);
      return;
    }
    console.log(\`Results: \${stdout}\`);
  });
}

// 9: Parameterized database query with placeholder bindings
export async function authenticateCustomer(dbClient: any, userEmail: string) {
  const query = "SELECT id, email, role, password_hash FROM customers WHERE email = $1";
  const result = await dbClient.query(query, [userEmail]);
  return result.rows;
}
`;

export const DEMO_NAME = "SecStore API Gateway (Python/Flask)";
export const REACT_DEMO_NAME = "PayPortal Enterprise Platform (React & Node.js)";
export const WORKSPACE_TARGET_NAME = "Security Showcase Target (React & Node Benchmark)";

export const demoVulnerable = (): FileEntry[] => [
  enc("api/app.py", APP_VULN),
  enc("api/services.py", SERVICES_VULN),
  enc("README.md", README)
];

export const demoPatched = (): FileEntry[] => [
  enc("api/app.py", APP_PATCHED),
  enc("api/services.py", SERVICES_PATCHED),
  enc("README.md", README)
];

export const demoReactVulnerable = (): FileEntry[] => [
  enc("demo-jury-vulnerabilities.tsx", JURY_VULN_FILE),
  enc("src/components/UserProfileCard.tsx", JURY_VULN_FILE),
  enc("README.md", README)
];

export const demoReactPatched = (): FileEntry[] => [
  enc("demo-jury-vulnerabilities.tsx", JURY_PATCHED_FILE),
  enc("src/components/UserProfileCard.tsx", JURY_PATCHED_FILE),
  enc("README.md", README)
];

export const demoWorkspaceVulnerable = (): FileEntry[] => [
  enc("demo-jury-vulnerabilities.tsx", JURY_VULN_FILE),
  enc("README.md", README)
];

export const demoReadme = README;

export const DEMO_EXPECTED = {
  vulnerable: [
    { category: "sqli", fn: "search_users", note: "f-string query into db.execute()" },
    { category: "cmdi", fn: "ping_host", note: "string command with shell=True" },
    { category: "cmdi", fn: "run_report", note: "os.system() reached from /api/reports/export via helper" },
    { category: "access", fn: "get_invoice", note: "invoice loaded by id without ownership check" },
  ],
  safe: ["find_customers uses a parameterized query"],
  patched: "All four paths removed: parameterized query, argument list without shell, shlex.quote(), and owner comparison with 403.",
};

# veilshift-t2-25
Official HackFest 2026 repository for team VeilShift (T2-25).

---

# Veilshift (FRIDAY) — Explainable Zero-Day Code Security & Virtual Hotpatching

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: TanStack Start](https://img.shields.io/badge/Framework-TanStack%20Start-black.svg)](https://tanstack.com/start)
[![Engine: NVIDIA Nemotron](https://img.shields.io/badge/Engine-NVIDIA%20Nemotron-76B900.svg)](https://build.nvidia.com)
[![Privacy: Client--Side AST](https://img.shields.io/badge/Privacy-100%25%20In--Browser%20AST-emerald.svg)](#privacy--threat-model)

> **Hackfest X Saividya Submission**  
> **Track**: Web Security, AI & Developer Infrastructure (Track 2)  
> **Repository**: [Hackfest-X-Saividya/veilshift-t2-25](https://github.com/Hackfest-X-Saividya/veilshift-t2-25)

---

## Overview

Modern Application Security (AppSec) tools suffer from three fundamental architectural flaws:

1. **The Zero-Day Gap**: Static analysis tools (SonarQube, Snyk, Semgrep) rely heavily on known CVE databases and fixed signatures. Novel vulnerabilities in custom application logic go undetected because no CVE exists yet.
2. **The 45-Day Remediation Window**: When a critical vulnerability is confirmed, writing code fixes, passing QA, and deploying production builds takes weeks. In the meantime, the attack surface remains exposed.
3. **The Privacy Breach**: Cloud-based "AI security" tools exfiltrate proprietary source code to external servers and third-party LLMs, violating strict enterprise compliance and air-gapped security mandates.

**Veilshift (FRIDAY)** is an in-browser code security platform designed to close these gaps:
- **Zero Code Exfiltration**: Lexical tokenization, Abstract Syntax Tree (AST) construction, and source-to-sink taint tracking execute entirely inside the developer's web browser. Source code never leaves the local machine.
- **Explainable Taint Flow Graph**: Instead of noisy flat lists with volatile line numbers, vulnerabilities are rendered as directed source-to-sink dataflow graphs (`@xyflow/react`).
- **Emergency Virtual Hotpatching**: Leverages NVIDIA Nemotron reasoning models to synthesize instant perimeter WAF rules (ModSecurity/Cloudflare) and drop-in framework middleware (Express/FastAPI) to protect live services while developers refactor code.
- **Interactive Countermeasure Lab**: A symbolic in-browser sandbox where engineers can test live exploit probes against toggled security controls.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER RUNTIME                          │
│                                                                        │
│   ┌────────────────────┐      ┌─────────────────────────────┐         │
│   │ Ingestion Engine   │ ───> │ Lexer & AST Taint Analyzer  │         │
│   │ Local / GitHub API │      │ (Python & TypeScript/JS)    │         │
│   └────────────────────┘      └──────────────┬──────────────┘         │
│                                              │                         │
│                    ┌─────────────────────────┴────────────┐            │
│                    ▼                                      ▼            │
│      ┌───────────────────────────┐          ┌───────────────────────┐  │
│      │ Interactive Taint Graph   │          │ Countermeasure Lab    │  │
│      │ (Source-to-Sink Dataflow) │          │ (Symbolic Simulation) │  │
│      └───────────────────────────┘          └───────────────────────┘  │
│                    │                                                   │
│                    ▼                                                   │
│      ┌───────────────────────────┐                                     │
│      │ IndexedDB Local Store     │                                     │
│      │ (Findings & Fingerprints) │                                     │
│      └─────────────┬─────────────┘                                     │
└────────────────────┼───────────────────────────────────────────────────┘
                     │  Strict Privacy Boundary (Metadata Only)
                     ▼  NO raw source code, NO file paths, NO tokens
┌────────────────────────────────────────────────────────────────────────┐
│             NVIDIA INTEGRATE API (Nemotron 3.5 Super-VL)               │
│                                                                        │
│      ┌───────────────────────────────┐                                 │
│      │ Zero-Day Exploitability Audit │                                 │
│      │ - Reachability Analysis       │                                 │
│      │ - Edge WAF Rules (ModSec/CF)  │                                 │
│      │ - Drop-in Runtime Middleware  │                                 │
│      └───────────────────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Capabilities

### 1. In-Browser AST & Lexical Taint Engine
- **Supported Languages & Frameworks**:
  - **Python**: Flask, FastAPI, SQLAlchemy, raw shell execution
  - **TypeScript & JavaScript**: React, Next.js, Express, Node.js, Vue
- **Tracked Vulnerabilities**:
  - SQL Injection (string interpolation, concatenation, unparameterized drivers)
  - Remote Command Execution (RCE) via `child_process.exec`, `os.system`, `subprocess`
  - React/DOM Cross-Site Scripting (XSS) via `dangerouslySetInnerHTML`, `javascript:` URIs
  - Reverse Tabnabbing (`target="_blank"` missing `rel="noopener noreferrer"`)
  - Insecure Dynamic Code Execution (`eval()`, `Function()`)
  - Hardcoded Secrets & Production Credentials (JWT keys, API keys, private tokens)
  - Broken Access Control (IDOR / unauthenticated route exposure)

### 2. Stable Syntax Fingerprinting
Traditional scanners break when a developer adds five lines of code because they track line numbers. Veilshift assigns a deterministic structural fingerprint to each finding:
```
fingerprint = hash(Category + RuleID + NormalizedSink + IngressSource + ScopeFunction)
```
Issues are reliably tracked across Git branches, refactors, and diff scans (`compare.ts`).

### 3. NVIDIA Nemotron Zero-Day Engine
When a high-severity or unconstrained taint path is detected, developers can trigger the Zero-Day Exploitability Audit (`src/lib/zero-day.functions.ts`):
- Evaluates ingress constraints and execution blast radius.
- Produces **production-ready edge virtual patches**:
  - Drop-in framework middleware (intercepts payloads before business logic execution).
  - WAF blocking patterns (Cloudflare / ModSecurity rule sets).

### 4. Symbolic Countermeasure Lab
Before modifying application code, developers can simulate attacks in a symbolic sandbox:
- Test attack probes: Boolean tautologies (`' OR '1'='1`), inline comments (`--`), shell escapes (`; cat /etc/passwd`).
- Toggle individual defenses (parameterized queries, type casting, input sanitizers) to see real-time containment status.

---

## Privacy & Threat Model

Veilshift was engineered specifically to adhere to zero-trust compliance standards:

| Layer | Processing Location | Data Transmitted |
| :--- | :--- | :--- |
| **Code Parsing** | 100% In-Browser (Web Worker / JS Runtime) | None (0 bytes exfiltrated) |
| **Taint Tracking** | 100% In-Browser AST Engine | None (0 bytes exfiltrated) |
| **History & Scans** | Client-side IndexedDB | None (persists in user's browser) |
| **Zero-Day Hotpatch** | NVIDIA Integrate API via Server Function | **Sanitized metadata only**: vulnerability type, framework, and generic sink signature. No application code, no file paths. |

---

## Getting Started

### Prerequisites
- Node.js 20+ (or Bun 1.1+)
- npm or pnpm
- (Optional) NVIDIA Integrate API Key for the Zero-Day Virtual Hotpatching feature

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hackfest-X-Saividya/veilshift-t2-25.git
   cd veilshift-t2-25
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Add your NVIDIA API key if you want to test the Nemotron zero-day hotpatch synthesis:
   ```env
   NVIDIA_API_KEY="your-nvapi-key"
   NVIDIA_MODEL="nvidia/nemotron-3.5-super-vl-120b-a12b"
   ```

4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verifying the Engine (Jury / Evaluator Test Suite)

A curated vulnerability showcase file is included directly in the root directory: [`demo-jury-vulnerabilities.tsx`](./demo-jury-vulnerabilities.tsx).

It contains real-world vulnerable patterns spanning React, Node.js, and Express:
- **Vulnerability 1**: Hardcoded production JWT secrets & private API keys
- **Vulnerability 2**: Insecure dynamic script evaluation (`eval(sessionStorage)`)
- **Vulnerability 3**: DOM XSS via un-sanitized `dangerouslySetInnerHTML`
- **Vulnerability 4**: Reverse Tabnabbing on external anchor tags
- **Vulnerability 5**: JavaScript pseudo-protocol execution (`href="javascript:..."`)
- **Vulnerability 6**: Remote Command Execution via `child_process.exec()`
- **Vulnerability 7**: Raw SQL Injection via string interpolation in PostgreSQL queries

### Quick Evaluation Walkthrough:
1. Navigate to **New Scan** (`/scan`).
2. Upload `demo-jury-vulnerabilities.tsx` (or enter any public GitHub repository URL).
3. Click **Analyze Repository** — notice that analysis completes locally in under 2 seconds.
4. Explore findings on the **Findings** page (`/findings`) or inspect the graph at `/graph`.
5. Click **Synthesize Zero-Day Audit** on any critical finding to generate the virtual patch and WAF rule via NVIDIA Nemotron.
6. Open the **Countermeasure Lab** (`/lab`) to simulate bypass probes vs active mitigations.

### Running Automated Unit Tests
```bash
npm run test
```
Runs the test suites for:
- Lexical AST tokenizer & taint path validation (`analyzer.test.ts`)
- TypeScript / React web analysis rules (`web-analyzer.test.ts`)
- GitHub repository parser & subpath ingestion (`github.test.ts`)
- Countermeasure probe containment (`countermeasure.test.ts`)

---

## Tech Stack

- **Frontend & Fullstack Runtime**: [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **UI Components & Styling**: React 19, Tailwind CSS v4, Radix UI primitives, Lucide Icons
- **Interactive Graphs**: `@xyflow/react` (React Flow)
- **Local Storage**: IndexedDB via `idb-keyval`
- **AI & Reasoning Engine**: NVIDIA Integrate API (`nvidia/nemotron-3.5-super-vl-120b-a12b`)
- **Test Framework**: Vitest

---

## Team & Acknowledgements

Developed for **Hackfest X Saividya 2026** by **Team Veilshift (Track 2, Team 25)**.

Special thanks to:
- The open-source security community for AST taint research.
- NVIDIA for providing high-throughput Nemotron reasoning APIs.

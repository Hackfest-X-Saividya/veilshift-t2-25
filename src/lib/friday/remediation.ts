import type { Finding } from "./types";

export interface Remediation {
  summary: string;
  steps: string[];
  before: string;
  after: string;
  why: string;
  review: string;
}

export function remediationFor(f: Finding): Remediation {
  // React dangerouslySetInnerHTML XSS
  if (f.ruleId === "REACT-XSS-001") {
    return {
      summary: "Sanitize HTML using DOMPurify before rendering, or refactor to standard React JSX children.",
      steps: [
        "Install and import DOMPurify (e.g., `import DOMPurify from 'dompurify'`).",
        "Pass untrusted HTML strings through `DOMPurify.sanitize(input)` before providing to `__html`.",
        "Prefer standard React JSX curly expressions `{content}` which escape HTML entities automatically.",
        "Configure DOMPurify allow-lists if only specific formatting tags (like <b>, <i>, <p>) are permitted.",
      ],
      before: `<div \n  className="bio-section"\n  dangerouslySetInnerHTML={{ __html: userBio }} \n/>`,
      after: `import DOMPurify from 'dompurify';\n\n<div \n  className="bio-section"\n  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userBio) }} \n/>`,
      why: "React disables its automatic XSS protection when dangerouslySetInnerHTML is used. DOMPurify parses the HTML against a living standard and strips malicious <script>, onerror handlers, and javascript: protocols.",
      review: "Ensure DOMPurify is executed in client-side context (or use isomorphic-dompurify in Next.js/SSR environments).",
    };
  }

  // DOM innerHTML XSS
  if (f.ruleId === "JS-DOM-XSS-002") {
    return {
      summary: "Use element.textContent instead of innerHTML, or sanitize with DOMPurify.",
      steps: [
        "Replace `.innerHTML` assignments with `.textContent` or `.innerText` whenever inserting plain text.",
        "If rich HTML is genuinely required, pass the string through DOMPurify.sanitize() first.",
        "Never concatenate user input or URL parameters directly into HTML strings.",
      ],
      before: `document.getElementById("output").innerHTML = "Hello, " + userName;`,
      after: `document.getElementById("output").textContent = "Hello, " + userName;`,
      why: "textContent treats all input as plain text without parsing HTML entities, completely neutralizing injection vectors.",
      review: "Check whether other DOM manipulation libraries (e.g. jQuery, Zepto) are used elsewhere in the codebase.",
    };
  }

  // Insecure eval() / Dynamic code execution
  if (f.ruleId === "JS-CODE-EVAL-003") {
    return {
      summary: "Eliminate eval() and Function(). Use JSON.parse() for data serialization or a typed lookup map.",
      steps: [
        "Replace `eval()` with `JSON.parse()` for parsing serialized strings or cached JSON objects.",
        "Wrap JSON.parse in a try/catch block to handle malformed inputs gracefully.",
        "For dynamic function calls, use a declarative dictionary/switch statement instead of executing code strings.",
      ],
      before: `const rawData = window.sessionStorage.getItem("cached_prefs") || '({})';\nconst parsed = eval(\`(\${rawData})\`);`,
      after: `const rawData = window.sessionStorage.getItem("cached_prefs") || '{}';\ntry {\n  const parsed = JSON.parse(rawData);\n  setProfile(parsed);\n} catch (err) {\n  console.error("Failed to parse cached preferences", err);\n}`,
      why: "eval() executes arbitrary code with full access to caller scope and the global window object. An attacker who controls sessionStorage or localStorage can achieve full persistent XSS.",
      review: "Enforce Content Security Policy (CSP) without 'unsafe-eval' to catch future regressions at the browser level.",
    };
  }

  // Node.js Command Injection
  if (f.ruleId === "NODE-CMDI-004") {
    return {
      summary: "Use child_process.execFile() or spawn() with discrete argument arrays without invoking a subshell.",
      steps: [
        "Replace `child_process.exec()` with `child_process.execFile()`.",
        "Pass arguments as separate array elements instead of interpolating into a single shell string.",
        "Validate input using a strict allow-list or regex (e.g., verifying valid hostnames or IP addresses).",
        "Never execute commands with `shell: true` when handling untrusted user input.",
      ],
      before: `exec(\`ping -c 2 \${networkHost}\`, (error, stdout) => {\n  console.log(stdout);\n});`,
      after: `import { execFile } from 'child_process';\n\n// 1. Strict regex validation\nif (!/^[a-zA-Z0-9.-]+$/.test(networkHost)) {\n  throw new Error("Invalid network host identifier");\n}\n\n// 2. Safe execution without subshell\nexecFile("ping", ["-c", "2", networkHost], (error, stdout) => {\n  console.log(stdout);\n});`,
      why: "execFile passes arguments directly to the operating system's process invocation API without invoking /bin/sh or cmd.exe. Shell metacharacters like ;, |, &&, and $(...) are treated as literal characters.",
      review: "Check whether arguments could be parsed as command flags (argument injection); use '--' where supported.",
    };
  }

  // Node.js SQL Injection
  if (f.ruleId === "NODE-SQLI-005") {
    return {
      summary: "Use parameterized queries with placeholder bindings ($1, ?, :param).",
      steps: [
        "Replace template literals and string concatenation with parameterized placeholders ($1 for pg, ? for sqlite3/mysql).",
        "Pass user values as a separate parameters array to the database client.",
        "Avoid dynamic table or column name interpolation; allow-list any dynamic identifier names.",
      ],
      before: `const query = \`SELECT id, email, role FROM customers WHERE email = '\${userEmail}'\`;\nconst result = await dbClient.query(query);`,
      after: `const query = "SELECT id, email, role FROM customers WHERE email = $1";\nconst result = await dbClient.query(query, [userEmail]);`,
      why: "Parameterized queries decouple the SQL query structure from data values. The database engine compiles the query plan first, making it impossible for user input to modify the SQL command syntax.",
      review: "Verify whether an ORM (Prisma, TypeORM, Drizzle) is available and prefer its type-safe query builders.",
    };
  }

  // Reverse Tabnabbing
  if (f.ruleId === "WEB-REVERSE-TABNABBING-006") {
    return {
      summary: "Add rel=\"noopener noreferrer\" to all target=\"_blank\" hyperlinks.",
      steps: [
        "Locate all `<a>` tags with `target=\"_blank\"`.",
        "Add `rel=\"noopener noreferrer\"` attribute to prevent the opened window from accessing `window.opener`.",
        "If using React components or design systems, set this as the default on custom Link components.",
      ],
      before: `<a href={websiteUrl} target="_blank">\n  Visit Personal Website\n</a>`,
      after: `<a href={websiteUrl} target="_blank" rel="noopener noreferrer">\n  Visit Personal Website\n</a>`,
      why: "Without `noopener`, the newly opened page has access to `window.opener` and can navigate the originating tab to a phishing clone using `window.opener.location = 'https://phishing.site'`.",
      review: "Modern evergreen browsers default to noopener on target=_blank, but legacy browsers and webviews remain vulnerable.",
    };
  }

  // JavaScript URI pseudo-protocol XSS
  if (f.ruleId === "WEB-JS-URI-XSS-007") {
    return {
      summary: "Replace javascript: pseudo-protocol URIs with semantic buttons and event handlers.",
      steps: [
        "Replace `<a href=\"javascript:...\">` with a `<button type=\"button\">`.",
        "Attach an `onClick` handler function to execute the desired logic.",
        "If rendering dynamic URLs in links, validate that the protocol is strictly `http:` or `https:`.",
      ],
      before: `<a href="javascript:alert('Session Hijacked: ' + document.cookie)">\n  Export Diagnostic Logs\n</a>`,
      after: `<button \n  type="button"\n  onClick={() => handleExportLogs()}\n  className="btn-export"\n>\n  Export Diagnostic Logs\n</button>`,
      why: "The `javascript:` pseudo-protocol executes script inside the current origin's context. Replacing it with event handlers prevents URL-based injection and complies with strict CSP policies.",
      review: "Implement a URL schema sanitizer helper: `function isSafeUrl(url) { return /^(https?:|mailto:|tel:)/i.test(url); }`.",
    };
  }

  // CSS Injection
  if (f.ruleId === "CSS-INJECTION-008") {
    return {
      summary: "Remove dynamic CSS expressions and restrict stylesheet properties to predefined classes.",
      steps: [
        "Remove all legacy CSS `expression()` or `javascript:` handlers in style attributes.",
        "Use CSS custom properties (variables) or strict Tailwind/utility classes instead of string concatenation.",
        "Sanitize any user-controlled styling values against a strict regex allow-list.",
      ],
      before: `<div style={{ width: "expression(alert(1))" }} />`,
      after: `<div className="w-full max-w-md" />`,
      why: "Dynamic CSS expressions can be leveraged to execute scripts or exfiltrate sensitive tokens via attribute selectors and background-image callbacks.",
      review: "Disallow inline style attributes in production via Content Security Policy `style-src 'self'`.",
    };
  }

  // Hardcoded Secret Leaks
  if (f.ruleId === "WEB-LEAKED-SECRET-009") {
    return {
      summary: "Move private API keys and secrets to server environment variables and secret managers.",
      steps: [
        "Remove all private API keys, JWT secrets, and signing credentials from frontend bundles.",
        "Store secrets in environment variables (`process.env.API_KEY`) on backend servers or in a cloud secret manager (AWS Secrets Manager, GCP Secret Manager).",
        "Route third-party API calls through a secure backend proxy rather than calling directly from the browser client.",
        "Immediately revoke and rotate the exposed credentials.",
      ],
      before: `export const PRODUCTION_CONFIG = {\n  apiKey: "sk-live-9928340192834019283401928340a1b2c3",\n  jwtSecret: "super-secret-jwt-signing-key-production-998822"\n};`,
      after: `// Client-safe configuration without exposed secrets\nexport const PRODUCTION_CONFIG = {\n  appName: "PayPortal Enterprise",\n  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/v1"\n};`,
      why: "Frontend code is shipped to and inspected by any client browser. Hardcoded secrets in client bundles allow anyone to extract credentials and impersonate your application.",
      review: "Run git-secrets or trufflehog in CI/CD pre-commit hooks to prevent credential commits.",
    };
  }

  // Python SQL Injection
  if (f.category === "sqli") {
    return {
      summary: "Use a parameterized query: keep the SQL text constant and pass untrusted values as bound parameters.",
      steps: [
        "Replace the f-string / concatenation / % / .format() with placeholders (? for sqlite3, %s for psycopg/MySQLdb, :name for SQLAlchemy text()).",
        "Pass the user-supplied values as the second argument to execute().",
        "If identifiers (table/column names, ORDER BY direction) must vary, map user input to a fixed allow-list instead of interpolating.",
      ],
      before: `query = f"SELECT * FROM users WHERE email LIKE '%{term}%'"\nrows = db.execute(query).fetchall()`,
      after: `rows = db.execute(\n    "SELECT * FROM users WHERE email LIKE ?",\n    (f"%{term}%",),\n).fetchall()`,
      why: "With bound parameters the database driver sends the query structure and the data separately, so input can never change the meaning of the SQL — quotes and keywords in it are treated as literal data.",
      review: "Check other callers and any query builders that wrap this call. Placeholder syntax depends on the database driver in use.",
    };
  }

  // Python Command Injection
  if (f.category === "cmdi") {
    return {
      summary: "Avoid the shell. Call the program with an argument list and validate the input against a strict allow-list.",
      steps: [
        "Replace os.system()/os.popen()/shell=True with subprocess.run([...]) passing each argument as a separate list element.",
        "Validate the input (e.g. a hostname regex or a fixed set of report names) before using it.",
        "If a shell is genuinely required, wrap each untrusted value with shlex.quote() and keep the rest of the command constant.",
        "Never pass untrusted input to eval()/exec(); use a parser such as json.loads or ast.literal_eval.",
      ],
      before: `subprocess.check_output("ping -c 1 " + host, shell=True)`,
      after: `import re, subprocess\nif not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", host):\n    abort(400)\nsubprocess.check_output(["ping", "-c", "1", host], timeout=5)`,
      why: "Without a shell, metacharacters like ; | && $( ) have no special meaning — the value arrives at the program as a single argument. Validation further limits what the program can be asked to do.",
      review: "Argument injection (values starting with -) is still possible for some programs; consider a `--` separator and keep validation in place.",
    };
  }

  // Broken Access Control / IDOR
  return {
    summary: "Authorize every object access: compare the resource's owner (or ACL) with the authenticated user and return 403/404 otherwise.",
    steps: [
      "Require authentication on the route (e.g. @login_required or Depends(get_current_user)).",
      "After loading the object, check it belongs to the caller — or scope the query by owner (WHERE id = ? AND owner_id = ?).",
      "Return 404 (or 403) when the check fails so identifiers can't be enumerated.",
      "Centralize the rule in a helper or policy so every route applies it consistently.",
    ],
    before: `invoice = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()\nreturn jsonify(invoice)`,
    after: `invoice = db.execute(\n    "SELECT * FROM invoices WHERE id = ? AND owner_id = ?",\n    (invoice_id, current_user.id),\n).fetchone()\nif invoice is None:\n    abort(404)\nreturn jsonify(invoice)`,
    why: "Authentication only proves who the caller is; the ownership check proves they're allowed to see this specific object. Scoping the query by owner makes unauthorized rows unreachable.",
    review: "Confirm no existing middleware or row-level security (RLS) already covers this route before changing it.",
  };
}

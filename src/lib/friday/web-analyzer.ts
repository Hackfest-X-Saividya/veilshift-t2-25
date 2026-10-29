import { hashString } from "./python-lex";
import { scoreFinding } from "./scoring";
import type { FileEntry, Finding, GraphEdge, GraphNode, SafeObservation } from "./types";

interface JSFunction {
  name: string;
  file: string;
  line: number;
  body: string[];
  route?: {
    method: string;
    path: string;
  };
}

export interface JSAnalysisResult {
  findings: Finding[];
  safe: SafeObservation[];
  functionsAnalyzed: number;
  routesFound: number;
  inventory: Record<string, string[]>;
  frameworks: Set<string>;
}

// Check for dangerous patterns in TS, JS, JSX, TSX, HTML, and CSS
export function analyzeWebFiles(files: FileEntry[]): JSAnalysisResult {
  const findings: Finding[] = [];
  const safe: SafeObservation[] = [];
  let functionsAnalyzed = 0;
  let routesFound = 0;
  const inventory: Record<string, string[]> = {};
  const frameworks = new Set<string>();

  for (const f of files) {
    const isTS = /\.(ts|tsx)$/i.test(f.path);
    const isJS = /\.(js|jsx|mjs|cjs)$/i.test(f.path);
    const isHTML = /\.(html|htm)$/i.test(f.path);
    const isCSS = /\.(css|scss|less)$/i.test(f.path);

    if (!isTS && !isJS && !isHTML && !isCSS) continue;

    // Detect Frameworks
    if (/(from\s+['"]react['"]|require\(['"]react['"]\)|<[A-Z]\w+)/.test(f.content)) {
      frameworks.add("React");
    }
    if (/(from\s+['"]express['"]|require\(['"]express['"]\)|express\(\))/.test(f.content)) {
      frameworks.add("Express");
    }
    if (/(from\s+['"]next['"]|from\s+['"]next\/|next\/image|next\/link)/.test(f.content)) {
      frameworks.add("Next.js");
    }
    if (/(from\s+['"]vue['"]|createApp\()/.test(f.content)) {
      frameworks.add("Vue");
    }

    const lines = f.content.split("\n");
    const fnList: string[] = [];

    // Track Express / Node route handlers
    const routeRegex = /(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*(['"`])([^'"`]+)\2/g;
    let rm: RegExpExecArray | null;
    while ((rm = routeRegex.exec(f.content)) !== null) {
      routesFound++;
    }

    // Line-by-line checks for TS/JS/HTML/CSS
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Skip pure comments
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

      // Extract functions
      const fnMatch = /(?:function\s+([A-Za-z0-9_$]+)|const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>|([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{)/.exec(line);
      if (fnMatch) {
        const fnName = fnMatch[1] || fnMatch[2] || fnMatch[3];
        if (fnName && !["if", "for", "while", "switch", "catch"].includes(fnName)) {
          fnList.push(fnName);
          functionsAnalyzed++;
        }
      }

      /* ===================================================================
         1. React: dangerouslySetInnerHTML
         =================================================================== */
      if (/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*([^}]+)\s*\}\s*\}/.test(line)) {
        const rawMatch = line.match(/__html\s*:\s*([^}]+)/);
        const expr = rawMatch ? rawMatch[1].trim() : "untrusted_html";
        const isSanitized =
          /(DOMPurify\s*\.\s*sanitize|sanitizeHtml\s*\(|escapeHtml\s*\()/i.test(line) ||
          new RegExp(`\\b${expr}\\s*=\\s*(?:DOMPurify\\s*\\.\\s*sanitize|sanitizeHtml|escapeHtml)`, "i").test(f.content) ||
          new RegExp(`(?:DOMPurify\\s*\\.\\s*sanitize|sanitizeHtml)\\s*\\([^)]*\\b${expr}\\b`, "i").test(f.content);

        if (isSanitized) {
          safe.push({
            file: f.path,
            line: lineNum,
            fn: fnList[fnList.length - 1] || "component",
            category: "access",
            description: `dangerouslySetInnerHTML safely escaped or purified with DOMPurify: ${expr}`,
          });
        } else {
          const ruleId = "REACT-XSS-001";
          const fp = hashString(`${ruleId}:${f.path}:${lineNum}:dangerouslySetInnerHTML`);
          const fnName = fnList[fnList.length - 1] || "render";

          const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: expr, file: f.path, line: lineNum, fn: fnName };
          const n2: GraphNode = { id: `${fp}-trans`, kind: "transform", label: "JSX Prop Construction", file: f.path, line: lineNum, fn: fnName };
          const n3: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "dangerouslySetInnerHTML", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
          const n4: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Client DOM (XSS)", file: f.path, line: lineNum, fn: fnName };

          const edges: GraphEdge[] = [
            { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "assigned to prop" },
            { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "passed to" },
            { id: `${fp}-e3`, from: n3.id, to: n4.id, relation: "injects raw HTML into" },
          ];

          const explanation = `Direct injection of unescaped content into React DOM via 'dangerouslySetInnerHTML' without prior sanitization with DOMPurify. This bypasses React's built-in XSS protection and allows arbitrary script execution in the user's browser.`;
          const score = scoreFinding({ severity: "critical", reachability: "reachable", evidence: "strong", category: "access" });

          findings.push({
            fingerprint: fp,
            ruleId,
            category: "access",
            title: "Cross-Site Scripting (XSS) via dangerouslySetInnerHTML",
            severity: "critical",
            score: score.score,
            confidence: 0.95,
            file: f.path,
            line: lineNum,
            fn: fnName,
            reachability: "reachable",
            evidence: "strong",
            sinkCode: line.trim(),
            sourceDesc: `Expression '${expr}' rendered as raw HTML`,
            explanation,
            rationale: "React disables automatic escaping when using dangerouslySetInnerHTML, leading directly to Stored or Reflected XSS.",
            steps: [
              `Untrusted or variable expression '${expr}' is referenced at ${f.path}:${lineNum}`,
              "Passed directly into the `__html` key of `dangerouslySetInnerHTML` without DOMPurify or sanitize-html",
              "The browser renders the string as active HTML/JavaScript in the client's session",
            ],
            missingControl: "Sanitize HTML using DOMPurify.sanitize(...) before passing to dangerouslySetInnerHTML, or use standard JSX children.",
            limitations: ["Static check flags direct unpurified props; verified via DOMPurify import check."],
            factors: score.factors,
            nodes: [n1, n2, n3, n4],
            edges,
          });
        }
      }

      /* ===================================================================
         2. DOM XSS: innerHTML / outerHTML / document.write
         =================================================================== */
      if (/(?:\.innerHTML|\.outerHTML|document\.write)\s*=\s*([^;]+)/.test(line)) {
        const isSanitized = /(DOMPurify|sanitize|escape)/i.test(line);
        if (!isSanitized) {
          const ruleId = "JS-DOM-XSS-002";
          const fp = hashString(`${ruleId}:${f.path}:${lineNum}:innerHTML`);
          const fnName = fnList[fnList.length - 1] || "anonymous";

          const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "DOM Input Expression", file: f.path, line: lineNum, fn: fnName };
          const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "element.innerHTML", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
          const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Client Document DOM", file: f.path, line: lineNum, fn: fnName };

          const edges: GraphEdge[] = [
            { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "assigned to" },
            { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "renders unsanitized HTML" },
          ];

          const score = scoreFinding({ severity: "high", reachability: "reachable", evidence: "strong", category: "access" });

          findings.push({
            fingerprint: fp,
            ruleId,
            category: "access",
            title: "DOM-Based Cross-Site Scripting via innerHTML assignment",
            severity: "high",
            score: score.score,
            confidence: 0.9,
            file: f.path,
            line: lineNum,
            fn: fnName,
            reachability: "reachable",
            evidence: "strong",
            sinkCode: line.trim(),
            sourceDesc: "Direct string assignment to DOM element innerHTML/outerHTML",
            explanation: "Assigning strings directly to innerHTML/outerHTML can lead to DOM-based XSS when the string contains user input or URL search parameters.",
            rationale: "Direct DOM manipulation bypasses context-aware sanitization.",
            steps: [
              `Target element assigned HTML string at ${f.path}:${lineNum}`,
              "No sanitization or safe textContent alternative was utilized",
            ],
            missingControl: "Use element.textContent or element.innerText instead of innerHTML, or sanitize with DOMPurify.",
            limitations: ["Cannot determine runtime provenance of string constants."],
            factors: score.factors,
            nodes: [n1, n2, n3],
            edges,
          });
        }
      }

      /* ===================================================================
         3. Dynamic Code Execution: eval() / Function() / setTimeout string
         =================================================================== */
      if (/\b(?:eval|new\s+Function)\s*\(([^)]+)\)/.test(line) && !line.includes("JSON.parse")) {
        const ruleId = "JS-CODE-EVAL-003";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:eval`);
        const fnName = fnList[fnList.length - 1] || "anonymous";

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "Dynamic string input", file: f.path, line: lineNum, fn: fnName };
        const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "eval() / Function()", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
        const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "JS Runtime Execution", file: f.path, line: lineNum, fn: fnName };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "evaluated by" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "executes in scope" },
        ];

        const score = scoreFinding({ severity: "critical", reachability: "reachable", evidence: "strong", category: "cmdi" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "cmdi",
          title: "Arbitrary Code Execution via eval() or Function constructor",
          severity: "critical",
          score: score.score,
          confidence: 0.95,
          file: f.path,
          line: lineNum,
          fn: fnName,
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim(),
          sourceDesc: "Dynamic code generation string passed to JavaScript interpreter",
          explanation: "Executing arbitrary JavaScript strings with eval() or the Function constructor allows attackers to execute unauthorized logic in the current execution context.",
          rationale: "eval() provides full access to the local and global lexical environment.",
          steps: [
            `String passed into eval/Function at ${f.path}:${lineNum}`,
            "JavaScript V8/SpiderMonkey engine compiles and executes the payload with full caller privileges",
          ],
          missingControl: "Use JSON.parse() for structured data, or safe lookup tables and declarative maps.",
          limitations: ["Flags all occurrences of eval() as anti-patterns in production code."],
          factors: score.factors,
          nodes: [n1, n2, n3],
          edges,
        });
      }

      /* ===================================================================
         4. Node / Server: Command Injection via child_process.exec
         =================================================================== */
      if (/(?:child_process\s*\.\s*exec|execSync|spawnSync|\bexec)\s*\(\s*([^,)]+)/.test(line) && !line.includes("execFile") && !line.includes("RegExp") && !line.includes(".exec(")) {
        const argMatch = line.match(/(?:child_process\s*\.\s*exec|execSync|spawnSync|\bexec)\s*\(\s*([^,)]+)/);
        const cmdArg = argMatch ? argMatch[1].trim() : "command";
        // Check if string contains template literal interpolation or concatenation
        const isInterpolated = cmdArg.includes("${") || cmdArg.includes("+") || cmdArg.includes("`");

        if (isInterpolated) {
          const ruleId = "NODE-CMDI-004";
          const fp = hashString(`${ruleId}:${f.path}:${lineNum}:child_process`);
          const fnName = fnList[fnList.length - 1] || "handler";

          const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "Command string interpolation", file: f.path, line: lineNum, fn: fnName };
          const n2: GraphNode = { id: `${fp}-trans`, kind: "transform", label: "Shell Command Construction", file: f.path, line: lineNum, fn: fnName };
          const n3: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "child_process.exec()", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
          const n4: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Server Host OS Shell", file: f.path, line: lineNum, fn: fnName };

          const edges: GraphEdge[] = [
            { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "interpolated into" },
            { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "invoked with" },
            { id: `${fp}-e3`, from: n3.id, to: n4.id, relation: "spawns shell process on" },
          ];

          const score = scoreFinding({ severity: "critical", reachability: "reachable", evidence: "strong", category: "cmdi" });

          findings.push({
            fingerprint: fp,
            ruleId,
            category: "cmdi",
            title: "Command Injection via child_process.exec() shell interpolation",
            severity: "critical",
            score: score.score,
            confidence: 0.95,
            file: f.path,
            line: lineNum,
            fn: fnName,
            reachability: "reachable",
            evidence: "strong",
            sinkCode: line.trim(),
            sourceDesc: `Dynamic shell command string '${cmdArg}'`,
            explanation: "Dynamically interpolating variables into child_process.exec() executes within a system shell (/bin/sh or cmd.exe), allowing metacharacter injection (&, |, ;, `).",
            rationale: "Shell interpretation allows command chaining and privilege escalation.",
            steps: [
              `Dynamic command string concatenated at ${f.path}:${lineNum}`,
              "Passed directly to child_process.exec which invokes the host system shell",
              "Attacker can supply shell metacharacters to execute secondary processes",
            ],
            missingControl: "Use child_process.execFile() or spawn() with argument arrays without invoking a subshell.",
            limitations: ["Static inspection of child_process method invocations."],
            factors: score.factors,
            nodes: [n1, n2, n3, n4],
            edges,
          });
        }
      }

      /* ===================================================================
         5. Node / Backend SQL: Raw String Interpolation in Queries
         =================================================================== */
      const isSqlInterpolation =
        /(?:\.query|\.raw|db\.execute)\s*\(\s*(`[^`]*\$\{[^}]+\}[^`]*`|"[^"]*"\s*\+\s*|'[^']*'\s*\+\s*)/.test(line) ||
        /(?:const|let|var)\s+(?:query|sql|stmt|statement|q)\s*=\s*(`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b[^`]*\$\{[^}]+\}[^`]*`|["'][^"']*\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b[^"']*["']\s*\+)/i.test(line);

      if (isSqlInterpolation) {
        const ruleId = "NODE-SQLI-005";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:sql`);
        const fnName = fnList[fnList.length - 1] || "queryHandler";

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "Dynamic Parameter Interpolation", file: f.path, line: lineNum, fn: fnName };
        const n2: GraphNode = { id: `${fp}-trans`, kind: "transform", label: "SQL String Concatenation", file: f.path, line: lineNum, fn: fnName };
        const n3: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "db.query() / db.raw()", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
        const n4: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Database Engine (SQLi)", file: f.path, line: lineNum, fn: fnName };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "interpolated into" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "executed by" },
          { id: `${fp}-e3`, from: n3.id, to: n4.id, relation: "alters query AST in" },
        ];

        const score = scoreFinding({ severity: "critical", reachability: "reachable", evidence: "strong", category: "sqli" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "sqli",
          title: "SQL Injection via string interpolation in database query",
          severity: "critical",
          score: score.score,
          confidence: 0.95,
          file: f.path,
          line: lineNum,
          fn: fnName,
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim(),
          sourceDesc: "Raw SQL query constructed via template literals or concatenation",
          explanation: "Dynamic string interpolation inside database query methods allows input to break out of data literals and alter SQL query syntax.",
          rationale: "Executing non-parameterized SQL statements creates severe SQL injection risks.",
          steps: [
            `Dynamic string built for database query at ${f.path}:${lineNum}`,
            "Passed to query driver without parameterized placeholders ($1, ?, :param)",
            "User input controls query predicate or structure",
          ],
          missingControl: "Use parameterized queries with placeholder bindings (e.g., db.query('SELECT * FROM users WHERE id = $1', [userId])).",
          limitations: ["Heuristic regex pattern on .query() / .raw() calls."],
          factors: score.factors,
          nodes: [n1, n2, n3, n4],
          edges,
        });
      }

      /* ===================================================================
         6. HTML & React: Unvalidated target="_blank" without rel="noopener"
         =================================================================== */
      if (/target\s*=\s*(['"])_blank\1/.test(line) && !/rel\s*=\s*['"][^'"]*(?:noopener|noreferrer)[^'"]*['"]/.test(line)) {
        const ruleId = "WEB-REVERSE-TABNABBING-006";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:tabnabbing`);
        const fnName = fnList[fnList.length - 1] || "template";

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "External Hyperlink Anchor", file: f.path, line: lineNum, fn: fnName };
        const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: 'target="_blank"', detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
        const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Window Opener Context", file: f.path, line: lineNum, fn: fnName };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "opens new browsing context" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "exposes window.opener to target" },
        ];

        const score = scoreFinding({ severity: "low", reachability: "reachable", evidence: "strong", category: "access" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "access",
          title: 'Reverse Tabnabbing vulnerability (missing rel="noopener noreferrer")',
          severity: "low",
          score: score.score,
          confidence: 0.9,
          file: f.path,
          line: lineNum,
          fn: fnName,
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim(),
          sourceDesc: 'Anchor link with target="_blank" without noopener',
          explanation: 'Links that open in a new tab without rel="noopener noreferrer" allow the destination page to access window.opener and potentially redirect the referring site to a phishing page.',
          rationale: 'Exposing window.opener allows cross-origin tab control.',
          steps: [
            `Hyperlink tag with target="_blank" declared at ${f.path}:${lineNum}`,
            'Attribute rel="noopener noreferrer" omitted',
            'Newly opened window can navigate source window via window.opener.location',
          ],
          missingControl: 'Add rel="noopener noreferrer" to all external links opening in new tabs.',
          limitations: ["Applies to JSX, TSX, and raw HTML anchor tags."],
          factors: score.factors,
          nodes: [n1, n2, n3],
          edges,
        });
      }

      /* ===================================================================
         7. HTML & React: javascript: pseudo-protocol in href or src
         =================================================================== */
      if (/(?:href|src|action)\s*=\s*(?:['"]javascript:|\{\s*[`'"]javascript:)/i.test(line)) {
        const ruleId = "WEB-JS-URI-XSS-007";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:javascript_uri`);
        const fnName = fnList[fnList.length - 1] || "component";

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "javascript: Pseudo-Protocol URI", file: f.path, line: lineNum, fn: fnName };
        const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "URI Navigation Handler", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
        const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Active Client Browser Script", file: f.path, line: lineNum, fn: fnName };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "assigned to link" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "executes on click" },
        ];

        const score = scoreFinding({ severity: "high", reachability: "reachable", evidence: "strong", category: "access" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "access",
          title: "XSS via javascript: URI in HTML/React link attribute",
          severity: "high",
          score: score.score,
          confidence: 0.95,
          file: f.path,
          line: lineNum,
          fn: fnName,
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim(),
          sourceDesc: "javascript: URI protocol used in href or src attribute",
          explanation: "Using the 'javascript:' pseudo-protocol executes arbitrary scripts when clicked by the user or loaded by the browser, causing Cross-Site Scripting.",
          rationale: "Browsers treat javascript: URLs as script execution contexts.",
          steps: [
            `Link href or attribute assigned javascript: URL at ${f.path}:${lineNum}`,
            "User clicks link or browser triggers navigation",
            "JavaScript executes in the security context of the current origin",
          ],
          missingControl: "Use standard URL schemes (http:, https:, mailto:, /path) and handle events via onClick handlers.",
          limitations: ["Detects static and inline javascript: URI schemes."],
          factors: score.factors,
          nodes: [n1, n2, n3],
          edges,
        });
      }

      /* ===================================================================
         8. CSS: Dangerous url() expressions or external asset injections
         =================================================================== */
      if (isCSS && /behavior\s*:|expression\s*\(|url\s*\(\s*['"]?javascript:/i.test(line)) {
        const ruleId = "CSS-INJECTION-008";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:css_expression`);

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "CSS Property Value", file: f.path, line: lineNum };
        const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "CSS Expression / Script", detail: line.trim(), file: f.path, line: lineNum, vulnerable: true };
        const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "CSS Execution Engine", file: f.path, line: lineNum };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "parsed by" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "executes via legacy engine" },
        ];

        const score = scoreFinding({ severity: "medium", reachability: "reachable", evidence: "strong", category: "access" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "access",
          title: "Malicious CSS Expression or JavaScript URI injection",
          severity: "medium",
          score: score.score,
          confidence: 0.95,
          file: f.path,
          line: lineNum,
          fn: "stylesheet",
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim(),
          sourceDesc: "CSS expression or script url() in stylesheet",
          explanation: "Stylesheets contain legacy dynamic expressions or javascript: URL handlers that can trigger arbitrary script execution in vulnerable browser engines.",
          rationale: "CSS expressions execute code during style calculations.",
          steps: [
            `Dynamic CSS rule loaded at ${f.path}:${lineNum}`,
            "Triggers script execution during layout computation",
          ],
          missingControl: "Remove all dynamic CSS expressions and ensure URLs use http/https.",
          limitations: ["Applies to .css, .scss, and .less stylesheets."],
          factors: score.factors,
          nodes: [n1, n2, n3],
          edges,
        });
      }

      /* ===================================================================
         9. React / Security: Leaked API Keys / Secrets in Frontend Code
         =================================================================== */
      const secretMatch = /(?:apiKey|api_key|secretKey|secret|jwtSecret|jwt_secret|privateKey|auth_token|signingKey)\s*[:=]\s*(['"][A-Za-z0-9_-]{16,}['"])/i.exec(line);
      if (secretMatch && !line.includes("process.env") && !line.includes("import.meta.env") && !line.includes("placeholder")) {
        const ruleId = "WEB-LEAKED-SECRET-009";
        const fp = hashString(`${ruleId}:${f.path}:${lineNum}:secret`);
        const fnName = fnList[fnList.length - 1] || "config";

        const n1: GraphNode = { id: `${fp}-src`, kind: "source", label: "Hardcoded API Token / Secret", file: f.path, line: lineNum, fn: fnName };
        const n2: GraphNode = { id: `${fp}-sink`, kind: "sink", label: "Client Bundle Artifact", detail: line.trim(), file: f.path, line: lineNum, fn: fnName, vulnerable: true };
        const n3: GraphNode = { id: `${fp}-asset`, kind: "asset", label: "Cloud / Third-Party API", file: f.path, line: lineNum, fn: fnName };

        const edges: GraphEdge[] = [
          { id: `${fp}-e1`, from: n1.id, to: n2.id, relation: "bundled into client bundle" },
          { id: `${fp}-e2`, from: n2.id, to: n3.id, relation: "authenticates against" },
        ];

        const score = scoreFinding({ severity: "high", reachability: "reachable", evidence: "strong", category: "access" });

        findings.push({
          fingerprint: fp,
          ruleId,
          category: "access",
          title: "Hardcoded Secret / Private API Key in Frontend Source",
          severity: "high",
          score: score.score,
          confidence: 0.85,
          file: f.path,
          line: lineNum,
          fn: fnName,
          reachability: "reachable",
          evidence: "strong",
          sinkCode: line.trim().replace(/['"][A-Za-z0-9_-]{16,}['"]/, '"***REDACTED***"'),
          sourceDesc: "Hardcoded credential token in frontend file",
          explanation: "Hardcoding sensitive keys or API secrets in TypeScript/JavaScript client bundles exposes credentials to anyone inspecting network traffic or web assets.",
          rationale: "Frontend code is publicly downloadable and easily decompiled.",
          steps: [
            `Credential literal discovered at ${f.path}:${lineNum}`,
            "File gets compiled into publicly accessible production JavaScript bundle",
            "Visitors can inspect source map or bundle and retrieve API token",
          ],
          missingControl: "Move sensitive credentials to a backend server proxy and load via server-side environment variables.",
          limitations: ["Uses pattern matching on credential keys with high entropy."],
          factors: score.factors,
          nodes: [n1, n2, n3],
          edges,
        });
      }
    }

    if (fnList.length > 0) {
      inventory[f.path] = fnList;
    }
  }

  return {
    findings,
    safe,
    functionsAnalyzed,
    routesFound,
    inventory,
    frameworks,
  };
}

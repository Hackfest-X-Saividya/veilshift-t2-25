import { analyzeWebFiles } from "./web-analyzer";
import { codeOnly, hashString, matchParen, splitArgs, toLogicalLines, type LogicalLine } from "./python-lex";
import { scoreFinding } from "./scoring";
import type {
  Category,
  EvidenceStrength,
  FileEntry,
  Finding,
  GraphEdge,
  GraphNode,
  SafeObservation,
} from "./types";

/* ------------------------------------------------------------------ */
/* Function model                                                      */
/* ------------------------------------------------------------------ */

interface RouteInfo {
  methods: string[];
  path: string;
  framework: "flask" | "fastapi";
  pathParams: string[];
}

export interface PyFunction {
  name: string;
  file: string;
  line: number;
  indent: number;
  params: { name: string; raw: string }[];
  decorators: string[];
  body: LogicalLine[];
  route?: RouteInfo;
}

interface FileModel {
  path: string;
  lines: LogicalLine[];
  functions: PyFunction[];
  frameworks: Set<string>;
  usesSqlAlchemyText: boolean;
  warnings: string[];
}

const DEF_RE = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const ROUTE_RE = /^@\s*([A-Za-z_][\w.]*)\.(route|get|post|put|delete|patch|api_route)\s*\(\s*[rbuf]*(['"])(.*?)\3(.*)$/;

function parseFile(file: FileEntry): FileModel {
  const { lines, warnings } = toLogicalLines(file.content);
  const frameworks = new Set<string>();
  if (/^\s*(from\s+flask\b|import\s+flask\b)/m.test(file.content)) frameworks.add("Flask");
  if (/^\s*(from\s+fastapi\b|import\s+fastapi\b)/m.test(file.content)) frameworks.add("FastAPI");
  const usesSqlAlchemyText = /from\s+sqlalchemy(\.\w+)*\s+import[^\n]*\btext\b/.test(file.content);
  const functions: PyFunction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const ll = lines[i];
    const m = DEF_RE.exec(ll.text);
    if (!m) continue;
    const masked = codeOnly(ll.text);
    const open = ll.text.indexOf("(", m[0].length - 1);
    const close = matchParen(masked, open);
    const params = splitArgs(ll.text.slice(open + 1, close), masked.slice(open + 1, close))
      .map((raw) => ({ raw, name: raw.replace(/^\*+/, "").split(/[:=]/)[0].trim() }))
      .filter((p) => p.name && p.name !== "/" && p.name !== "*");
    const decorators: string[] = [];
    for (let j = i - 1; j >= 0 && lines[j].text.startsWith("@") && lines[j].indent === ll.indent; j--) decorators.unshift(lines[j].text);
    const body: LogicalLine[] = [];
    for (let j = i + 1; j < lines.length && lines[j].indent > ll.indent; j++) body.push(lines[j]);
    const fn: PyFunction = { name: m[1], file: file.path, line: ll.line, indent: ll.indent, params, decorators, body };
    for (const d of decorators) {
      const r = ROUTE_RE.exec(d);
      if (!r) continue;
      const verb = r[2];
      const path = r[4];
      const flaskParams = [...path.matchAll(/<(?:[\w]+:)?(\w+)>/g)].map((x) => x[1]);
      const fastParams = [...path.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((x) => x[1]);
      let methods = verb === "route" || verb === "api_route" ? ["GET"] : [verb.toUpperCase()];
      const mm = /methods\s*=\s*\[([^\]]*)\]/.exec(r[5]);
      if (mm) methods = [...mm[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1].toUpperCase());
      const framework: "flask" | "fastapi" =
        verb === "route" && !frameworks.has("FastAPI") ? "flask" : frameworks.has("FastAPI") && !frameworks.has("Flask") ? "fastapi" : flaskParams.length ? "flask" : fastParams.length ? "fastapi" : verb === "route" ? "flask" : "fastapi";
      fn.route = { methods, path, framework, pathParams: framework === "flask" ? flaskParams : fastParams };
      break;
    }
    functions.push(fn);
  }
  return { path: file.path, lines, functions, frameworks, usesSqlAlchemyText, warnings };
}

/* ------------------------------------------------------------------ */
/* Taint model                                                         */
/* ------------------------------------------------------------------ */

type Origin = "request" | "path_param" | "fastapi_param" | "cli";

interface Taint {
  chain: GraphNode[];
  rels: string[]; // rels[i] = relation from chain[i-1] to chain[i]
  built: boolean;
  text: string;
  sanitizedFor: Set<Category>;
  weakSanitizer?: string;
  origin: Origin;
  sourceDesc: string;
  inter: number;
}

function extend(t: Taint, node: GraphNode, rel: string, patch: Partial<Taint> = {}): Taint {
  if (t.chain.some((n) => n.id === node.id)) return { ...t, ...patch };
  return { ...t, chain: [...t.chain, node], rels: [...t.rels, rel], ...patch, sanitizedFor: patch.sanitizedFor ?? new Set(t.sanitizedFor) };
}

const nid = (file: string, line: number, kind: string, label: string) => `${file}:${line}:${kind}:${label.replace(/\s+/g, "_").slice(0, 40)}`;

const SOURCE_RE = /\brequest\.(args|form|values|files|cookies|headers|json|data|query_params|path_params|get_json|body|stream)\b/g;
const OTHER_SOURCES: { re: RegExp; desc: string; origin: Origin }[] = [
  { re: /(?<![\w.])input\s*\(/g, desc: "input()", origin: "cli" },
  { re: /\bsys\.argv\b/g, desc: "sys.argv", origin: "cli" },
];
const SQL_KW = /\b(select|insert\s+into|update|delete\s+from|from|where|values|order\s+by|drop\s+table|create\s+table)\b/i;
const SENSITIVE_ASSET = /(user|account|payment|order|credential|password|token|invoice|admin|customer|secret|session|card|salary|patient|record|document|file)/i;

const SINK_METHODS = new Set(["execute", "executemany", "executescript", "raw", "read_sql", "read_sql_query", "system", "popen", "run", "call", "Popen", "check_output", "check_call", "getoutput", "getstatusoutput", "eval", "exec", "text"]);
const BUILTINS = new Set(["print", "len", "str", "int", "float", "bool", "list", "dict", "set", "tuple", "range", "open", "isinstance", "getattr", "setattr", "hasattr", "super", "type", "format", "repr", "sorted", "min", "max", "sum", "abs", "any", "all", "zip", "map", "filter", "enumerate", "jsonify", "render_template", "redirect", "abort", "url_for"]);

interface Ctx {
  files: Map<string, FileModel>;
  byName: Map<string, PyFunction>;
  moduleNames: Set<string>;
  findings: Map<string, Finding>;
  safe: SafeObservation[];
  entry?: PyFunction;
  enabled: Record<Category, boolean>;
  globalAuthHook: boolean;
  visiting: Set<string>;
}

/* ------------------------------------------------------------------ */
/* Expression evaluation                                               */
/* ------------------------------------------------------------------ */

function findSource(expr: string, masked: string, fn: PyFunction, line: number): Taint | null {
  SOURCE_RE.lastIndex = 0;
  const m = SOURCE_RE.exec(masked);
  if (m) {
    const tail = expr.slice(m.index, m.index + 80);
    const key = /^request\.\w+(?:\.get\(\s*['"]([^'"]+)['"]|\[\s*['"]([^'"]+)['"]\s*\])/.exec(tail);
    const desc = key ? `request.${m[1]}['${key[1] ?? key[2]}']` : `request.${m[1]}`;
    return newSource(fn, line, desc, "request");
  }
  for (const s of OTHER_SOURCES) {
    s.re.lastIndex = 0;
    if (s.re.test(masked)) return newSource(fn, line, s.desc, s.origin);
  }
  return null;
}

function newSource(fn: PyFunction, line: number, desc: string, origin: Origin): Taint {
  const src: GraphNode = { id: nid(fn.file, line, "source", desc), kind: "source", label: desc, detail: originLabel(origin), file: fn.file, line, fn: fn.name };
  const chain: GraphNode[] = [src];
  const rels: string[] = [""];
  if (fn.route) {
    chain.push(routeNode(fn));
    rels.push("received by");
  }
  return { chain, rels, built: false, text: "", sanitizedFor: new Set(), origin, sourceDesc: desc, inter: 0 };
}

function originLabel(o: Origin) {
  return o === "request" ? "HTTP request input" : o === "path_param" ? "URL path parameter" : o === "fastapi_param" ? "FastAPI request parameter" : "Process input";
}

function routeNode(fn: PyFunction): GraphNode {
  const r = fn.route!;
  return { id: nid(fn.file, fn.line, "route", fn.name), kind: "route", label: `${r.methods.join("/")} ${r.path}`, detail: `Route handler ${fn.name}()`, file: fn.file, line: fn.line, fn: fn.name };
}

function refVars(masked: string, vars: Map<string, Taint>): Taint[] {
  const out: Taint[] = [];
  for (const [name, t] of vars) {
    const re = new RegExp(`(?<![\\w.])${name.replace(/\./g, "\\.")}(?![\\w])`);
    if (re.test(masked)) out.push(t);
  }
  return out;
}

function isBuilt(expr: string, masked: string): string | null {
  if (/(?:^|[^\w])[rbuRBU]?[fF][rR]?['"]/.test(expr) && /\{[^}]+\}/.test(masked)) return "f-string interpolation";
  if (/\.format\s*\(/.test(masked)) return "str.format()";
  if (/['"]\s*%\s*[\w(]/.test(expr) || /\)\s*%\s*\w/.test(masked)) return "% formatting";
  if (/\+/.test(masked) && /['"]/.test(expr)) return "string concatenation";
  if (/\.join\s*\(/.test(masked)) return "str.join()";
  return null;
}

function sanitizerOf(expr: string): { cats: Category[]; weak?: string; label?: string } {
  const t = expr.trim();
  if (/^(int|float|uuid\.UUID|bool|abs)\s*\(/.test(t)) return { cats: ["sqli", "cmdi"], label: `${t.split("(")[0]}() type cast` };
  if (/^shlex\.quote\s*\(/.test(t) || /^pipes\.quote\s*\(/.test(t)) return { cats: ["cmdi"], label: "shlex.quote()" };
  if (/\.isdigit\(\)|\.isalnum\(\)|re\.fullmatch\(/.test(t)) return { cats: [], weak: "input validation" };
  if (/\.replace\s*\(\s*['"]['";]/.test(t) || /\.strip\s*\(\s*['"]['";]/.test(t)) return { cats: [], weak: "character stripping" };
  return { cats: [] };
}

function evalExpr(expr: string, vars: Map<string, Taint>, fn: PyFunction, line: number, ctx: Ctx, purpose: "assign" | "sink"): Taint | null {
  const masked = codeOnly(expr);
  let t: Taint | null = refVars(masked, vars)[0] ?? findSource(expr, masked, fn, line);

  // inter-procedural: calls to project functions whose return is tainted
  const callT = projectCalls(expr, masked, vars, fn, line, ctx);
  if (!t && callT) t = callT;
  else if (t && callT && callT.chain.length > t.chain.length) t = callT;
  if (!t) return null;

  const built = isBuilt(expr, masked);
  const san = sanitizerOf(expr);
  if (san.cats.length || san.weak) {
    const node: GraphNode = { id: nid(fn.file, line, "sanitizer", san.label ?? san.weak!), kind: "sanitizer", label: san.label ?? san.weak!, detail: san.cats.length ? "Recognized protective operation" : "Partial validation — not a reliable control", file: fn.file, line, fn: fn.name };
    const sanitizedFor = new Set(t.sanitizedFor);
    san.cats.forEach((c) => sanitizedFor.add(c));
    t = extend(t, node, "passes through", { sanitizedFor, weakSanitizer: san.weak ?? t.weakSanitizer });
  }
  if (built) {
    const isSql = SQL_KW.test(expr);
    const label = isSql ? "Query construction" : purpose === "sink" ? "Command construction" : /\b(ls|cat|ping|tar|zip|grep|curl|wget|convert|ffmpeg|echo|rm|cp|mv|git|nslookup|dig)\b/.test(expr) ? "Command construction" : "String construction";
    const node: GraphNode = { id: nid(fn.file, line, "transform", label), kind: "transform", label, detail: `${built} with untrusted value`, file: fn.file, line, fn: fn.name };
    t = extend(t, node, `interpolated via ${built}`, { built: true, text: t.text + " " + expr });
  } else {
    t = { ...t, text: t.text + " " + expr };
  }
  return t;
}

function projectCalls(expr: string, masked: string, vars: Map<string, Taint>, fn: PyFunction, line: number, ctx: Ctx): Taint | null {
  const re = /(?:(\b[A-Za-z_]\w*)\.)?\b([A-Za-z_]\w*)\s*\(/g;
  let best: Taint | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    const qual = m[1];
    const name = m[2];
    if (BUILTINS.has(name) || SINK_METHODS.has(name) || name === fn.name) continue;
    if (qual && qual !== "self" && qual !== "cls" && !ctx.moduleNames.has(qual)) continue;
    const callee = ctx.byName.get(name);
    if (!callee || callee.route) continue;
    const open = m.index + m[0].length - 1;
    const close = matchParen(masked, open);
    const args = splitArgs(expr.slice(open + 1, close), masked.slice(open + 1, close));
    const params = callee.params.filter((p) => p.name !== "self" && p.name !== "cls");
    const tainted = new Map<string, Taint>();
    args.forEach((a, idx) => {
      const kw = /^([A-Za-z_]\w*)\s*=(?!=)\s*(.*)$/.exec(a);
      const pname = kw ? kw[1] : params[idx]?.name;
      const aexpr = kw ? kw[2] : a;
      if (!pname) return;
      const at = refVars(codeOnly(aexpr), vars)[0] ?? findSource(aexpr, codeOnly(aexpr), fn, line);
      if (!at) return;
      const call: GraphNode = { id: nid(fn.file, line, "call", `${name}()`), kind: "call", label: `${name}(${pname})`, detail: `Calls ${callee.file}:${callee.line}`, file: fn.file, line, fn: fn.name };
      const param: GraphNode = { id: nid(callee.file, callee.line, "variable", `${name}.${pname}`), kind: "variable", label: pname, detail: `Parameter of ${name}()`, file: callee.file, line: callee.line, fn: name };
      tainted.set(pname, extend(extend(at, call, "passed to"), param, "bound to parameter", { inter: at.inter + 1 }));
    });
    if (!tainted.size) continue;
    const ret = analyzeFunction(callee, tainted, ctx);
    if (ret) {
      const back: GraphNode = { id: nid(fn.file, line, "call", `${name}() return`), kind: "call", label: `return of ${name}()`, detail: "Tainted return value", file: fn.file, line, fn: fn.name };
      const t = extend(ret, back, "returned to caller");
      if (!best || t.chain.length > best.chain.length) best = t;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Sinks                                                               */
/* ------------------------------------------------------------------ */

interface SinkMatch {
  category: Category;
  ruleId: string;
  name: string;
  args: string[];
  shell: boolean;
  open: number;
}

function findSinks(text: string, masked: string, file: FileModel): SinkMatch[] {
  const out: SinkMatch[] = [];
  const push = (category: Category, ruleId: string, name: string, open: number) => {
    const close = matchParen(masked, open);
    const args = splitArgs(text.slice(open + 1, close), masked.slice(open + 1, close));
    const shell = args.some((a) => /^shell\s*=\s*True$/.test(a));
    out.push({ category, ruleId, name, args, shell, open });
  };
  for (const m of masked.matchAll(/\.(execute|executemany|executescript|raw|read_sql|read_sql_query)\s*\(/g)) push("sqli", "FRI-SQL-001", m[1], m.index! + m[0].length - 1);
  if (file.usesSqlAlchemyText) for (const m of masked.matchAll(/(?<![\w.])text\s*\(/g)) push("sqli", "FRI-SQL-001", "text", m.index! + m[0].length - 1);
  for (const m of masked.matchAll(/\bos\.(system|popen)\s*\(/g)) push("cmdi", "FRI-CMD-001", `os.${m[1]}`, m.index! + m[0].length - 1);
  for (const m of masked.matchAll(/\bsubprocess\.(run|call|Popen|check_output|check_call|getoutput|getstatusoutput)\s*\(/g)) push("cmdi", "FRI-CMD-002", `subprocess.${m[1]}`, m.index! + m[0].length - 1);
  for (const m of masked.matchAll(/(?<![\w.])(eval|exec)\s*\(/g)) push("cmdi", "FRI-CMD-003", m[1], m.index! + m[0].length - 1);
  return out;
}

function tableOf(text: string): string | null {
  const m = /\b(?:from|into|update|join)\s+[`"[]?([A-Za-z_][\w.]*)/i.exec(text);
  return m ? m[1] : null;
}

function handleSinks(ll: LogicalLine, fn: PyFunction, vars: Map<string, Taint>, ctx: Ctx) {
  const file = ctx.files.get(fn.file)!;
  const masked = codeOnly(ll.text);
  for (const s of findSinks(ll.text, masked, file)) {
    if (!ctx.enabled[s.category]) continue;
    const first = s.args[0];
    if (!first) continue;
    const firstIsList = /^[[(]/.test(first) && s.category === "cmdi";
    const t = evalExpr(first, vars, fn, ll.line, ctx, "sink");
    const restTainted = s.args.slice(1).some((a) => refVars(codeOnly(a), vars).length || findSource(a, codeOnly(a), fn, ll.line));

    if (s.category === "sqli") {
      if (!t) {
        if (restTainted) ctx.safe.push({ file: fn.file, line: ll.line, fn: fn.name, category: "sqli", description: `Parameterized query: untrusted values are passed separately to ${s.name}()` });
        continue;
      }
      if (t.sanitizedFor.has("sqli")) {
        ctx.safe.push({ file: fn.file, line: ll.line, fn: fn.name, category: "sqli", description: `Untrusted value is type-cast before reaching ${s.name}()` });
        continue;
      }
      emit(ctx, fn, ll, s, t, t.built ? "FRI-SQL-001" : "FRI-SQL-002");
    } else {
      const isSubprocess = s.name.startsWith("subprocess.") && !/getoutput|getstatusoutput/.test(s.name);
      if (isSubprocess && !s.shell) {
        if (t || firstIsList) ctx.safe.push({ file: fn.file, line: ll.line, fn: fn.name, category: "cmdi", description: `${s.name}() called with an argument list and no shell interpretation` });
        continue;
      }
      if (!t) continue;
      if (t.sanitizedFor.has("cmdi")) {
        ctx.safe.push({ file: fn.file, line: ll.line, fn: fn.name, category: "cmdi", description: `Untrusted value is quoted/cast before reaching ${s.name}()` });
        continue;
      }
      emit(ctx, fn, ll, s, t, s.ruleId);
    }
  }
}

function emit(ctx: Ctx, fn: PyFunction, ll: LogicalLine, s: SinkMatch, t: Taint, ruleId: string) {
  const sinkLabel = s.category === "sqli" ? `${s.name}()` : s.name === "eval" || s.name === "exec" ? `${s.name}()` : `${s.name}(${s.shell ? "shell=True" : ""})`;
  const sink: GraphNode = { id: nid(fn.file, ll.line, "sink", sinkLabel), kind: "sink", label: sinkLabel, detail: s.category === "sqli" ? "Database query execution" : s.name === "eval" || s.name === "exec" ? "Dynamic code evaluation" : "Operating system command execution", file: fn.file, line: ll.line, fn: fn.name, vulnerable: true };
  let full = extend(t, sink, s.category === "sqli" ? "executed as SQL" : "executed by shell");
  const table = s.category === "sqli" ? tableOf(full.text + " " + ll.text) : null;
  const asset: GraphNode = s.category === "sqli"
    ? { id: nid(fn.file, ll.line, "asset", table ?? "database"), kind: "asset", label: table ? `Table ${table}` : "Database", detail: "Data that could be read or modified", file: fn.file, line: ll.line, fn: fn.name }
    : { id: nid(fn.file, ll.line, "asset", "host"), kind: "asset", label: s.name === "eval" || s.name === "exec" ? "Python interpreter" : "Server host / OS shell", detail: "Process runs with the application's privileges", file: fn.file, line: ll.line, fn: fn.name };
  full = extend(full, asset, "affects");

  const entry = ctx.entry;
  const routed = !!entry?.route;
  const reach = routed && full.origin !== "cli" ? "reachable" : "uncertain";
  const evidence: EvidenceStrength = full.weakSanitizer ? "weak" : full.inter > 0 || full.origin === "fastapi_param" ? "moderate" : "strong";
  const sinkCode = ll.text.replace(/\s+/g, " ").trim();
  const fingerprint = hashString([s.category, ruleId, fn.file, fn.name, sinkCode, full.sourceDesc].join("|"));
  if (ctx.findings.has(fingerprint)) {
    const ex = ctx.findings.get(fingerprint)!;
    if (ex.reachability === "reachable" || reach !== "reachable") return;
  }
  const nodes = full.chain.map((n) => ({ ...n }));
  const edges: GraphEdge[] = nodes.slice(1).map((n, i) => ({ id: `e${i}-${n.id}`, from: nodes[i].id, to: n.id, relation: full.rels[i + 1] || "flows to" }));
  const routeStr = entry?.route ? `${entry.route.methods.join("/")} ${entry.route.path}` : undefined;
  const catWord = s.category === "sqli" ? "SQL injection" : s.name === "eval" || s.name === "exec" ? "Code injection" : "Command injection";
  const authn = entry ? hasAuthn(entry) : false;
  const { score, severity, factors, confidence } = scoreFinding({
    category: s.category,
    ruleId,
    publicRoute: reach === "reachable" && !authn,
    authenticated: authn,
    reachability: reach,
    evidence,
    shellSink: s.shell || /os\.system|os\.popen|getoutput|eval|exec/.test(s.name),
    multiStatement: s.name === "executescript",
    sensitiveAsset: !!(table && SENSITIVE_ASSET.test(table)) || s.category === "cmdi",
    weakSanitizer: full.weakSanitizer,
    interprocedural: full.inter,
    origin: full.origin,
  });
  const steps = nodes.map((n, i) => describeStep(n, i === 0 ? "" : full.rels[i]));
  const finding: Finding = {
    fingerprint,
    ruleId,
    category: s.category,
    title: `${catWord} in ${fn.name}() via ${full.sourceDesc}`,
    severity,
    score,
    confidence,
    file: fn.file,
    line: ll.line,
    fn: fn.name,
    route: routeStr,
    reachability: reach,
    evidence,
    sinkCode,
    sourceDesc: full.sourceDesc,
    explanation:
      s.category === "sqli"
        ? `Untrusted input from ${full.sourceDesc} becomes part of the SQL text executed by ${s.name}(). An attacker can change the structure of the query — for example to read other rows, bypass filters, or modify data${table ? ` in ${table}` : ""}.`
        : s.name === "eval" || s.name === "exec"
          ? `Untrusted input from ${full.sourceDesc} is evaluated as Python code. An attacker could run arbitrary code inside the application process.`
          : `Untrusted input from ${full.sourceDesc} is placed into a command string interpreted by a shell. Shell metacharacters such as ; | && $( ) let an attacker run additional commands on the server.`,
    rationale:
      ruleId === "FRI-SQL-001"
        ? "Rule FRI-SQL-001 matches a database execution call whose query argument was built with string formatting that includes a tainted value."
        : ruleId === "FRI-SQL-002"
          ? "Rule FRI-SQL-002 matches a database execution call whose entire query argument is derived from a tainted value."
          : ruleId === "FRI-CMD-002"
            ? "Rule FRI-CMD-002 matches a subprocess call with shell=True whose command argument contains a tainted value."
            : ruleId === "FRI-CMD-003"
              ? "Rule FRI-CMD-003 matches eval()/exec() receiving a tainted value."
              : "Rule FRI-CMD-001 matches os.system()/os.popen(), which always invoke a shell, receiving a tainted value.",
    steps,
    missingControl:
      s.category === "sqli"
        ? "No parameter binding: the value is not passed through the driver's placeholder parameters, and no recognized type cast was applied."
        : "No shell-free invocation: the command is a single string handed to a shell, and no recognized quoting (shlex.quote) or strict allow-list was applied.",
    limitations: [
      "Static analysis: the code was read, not executed. Runtime configuration, middleware and database drivers were not observed.",
      full.inter > 0 ? `The path crosses ${full.inter} function boundar${full.inter > 1 ? "ies" : "y"}; other call sites of the helper were not individually verified.` : "The path was traced within a single function.",
      reach === "uncertain" ? "No HTTP route was found that reaches this code; reachability is uncertain." : "The entry point is a registered web route.",
      ...(full.weakSanitizer ? [`A partial control (${full.weakSanitizer}) was observed; FRIDAY cannot prove it is sufficient.`] : []),
      "Branch conditions are not evaluated: the path may be guarded by logic FRIDAY does not model.",
    ],
    factors,
    nodes,
    edges,
  };
  ctx.findings.set(fingerprint, finding);
}

function describeStep(n: GraphNode, rel: string): string {
  const loc = n.file ? ` (${n.file}:${n.line})` : "";
  switch (n.kind) {
    case "source": return `Untrusted value enters from ${n.label}${loc}.`;
    case "route": return `It is ${rel || "handled"} the route handler ${n.detail?.replace("Route handler ", "")} for ${n.label}${loc}.`;
    case "variable": return `It is ${rel} \`${n.label}\`${loc}.`;
    case "transform": return `${n.label}: ${n.detail}${loc}.`;
    case "call": return `It is ${rel} ${n.label}${loc}.`;
    case "sanitizer": return `It passes through ${n.label} — ${n.detail?.toLowerCase()}${loc}.`;
    case "sink": return `The value reaches the sensitive operation ${n.label}${loc}.`;
    case "asset": return `Affected resource: ${n.label}. ${n.detail}.`;
    case "missing_check": return `${n.label}: ${n.detail}`;
  }
}

/* ------------------------------------------------------------------ */
/* Function analysis                                                   */
/* ------------------------------------------------------------------ */

const ASSIGN_RE = /^([A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_][\w.]*)*)\s*(?::\s*[^=]+?)?\s*(\+=|=)(?!=)\s*([\s\S]+)$/;

function analyzeFunction(fn: PyFunction, initial: Map<string, Taint>, ctx: Ctx): Taint | null {
  const key = `${fn.file}:${fn.name}:${[...initial.keys()].sort().join(",")}`;
  if (ctx.visiting.has(key) || ctx.visiting.size > 6) return null;
  ctx.visiting.add(key);
  const vars = new Map(initial);
  let ret: Taint | null = null;
  for (const ll of fn.body) {
    if (DEF_RE.test(ll.text) || ll.text.startsWith("@") || ll.text.startsWith("class ")) continue;
    const text = ll.text;
    const a = ASSIGN_RE.exec(text);
    if (a && !/^(if|elif|while|return|assert|with|for)\b/.test(text)) {
      const targets = a[1].split(",").map((s) => s.trim());
      const t = evalExpr(a[3], vars, fn, ll.line, ctx, "assign");
      for (const target of targets) {
        if (t) {
          const v: GraphNode = { id: nid(fn.file, ll.line, "variable", target), kind: "variable", label: target, detail: `Assigned in ${fn.name}()`, file: fn.file, line: ll.line, fn: fn.name };
          const prev = a[2] === "+=" ? vars.get(target) : undefined;
          const base = prev && prev.chain.length > t.chain.length ? prev : t;
          vars.set(target, extend(base, v, "assigned to"));
        } else if (a[2] === "=") vars.delete(target);
      }
    }
    const fm = /^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/.exec(text);
    if (fm) {
      const t = evalExpr(fm[2], vars, fn, ll.line, ctx, "assign");
      if (t) vars.set(fm[1], extend(t, { id: nid(fn.file, ll.line, "variable", fm[1]), kind: "variable", label: fm[1], detail: "Loop variable", file: fn.file, line: ll.line, fn: fn.name }, "iterated as"));
    }
    handleSinks(ll, fn, vars, ctx);
    if (!a) projectCalls(text, codeOnly(text), vars, fn, ll.line, ctx);
    const rm = /^return\s+(.+)$/.exec(text);
    if (rm && !ret) ret = evalExpr(rm[1], vars, fn, ll.line, ctx, "assign");
  }
  ctx.visiting.delete(key);
  return ret;
}

/* ------------------------------------------------------------------ */
/* Access control                                                      */
/* ------------------------------------------------------------------ */

const AUTHN_DECORATOR = /@(?:[\w.]*\.)?(login_required|jwt_required|auth_required|requires_auth|token_required|authenticated|permission_required|roles_required|admin_required|roles_accepted|require_login)\b/;
const AUTHZ_DECORATOR = /@(?:[\w.]*\.)?(permission_required|roles_required|admin_required|roles_accepted|owner_required)\b/;
const AUTHN_DEP = /Depends\(\s*(get_current_user|get_current_active_user|current_user|require_user|verify_token|auth\w*|get_user)/;

function hasAuthn(fn: PyFunction): boolean {
  if (fn.decorators.some((d) => AUTHN_DECORATOR.test(d))) return true;
  if (fn.params.some((p) => AUTHN_DEP.test(p.raw))) return true;
  return fn.body.some((l) => /\b(current_user|get_jwt_identity\(\)|g\.user|session\[\s*['"]user)/.test(l.text) && /\b(if|not|is None|abort|raise)\b/.test(l.text));
}

function hasAuthz(fn: PyFunction): boolean {
  if (fn.decorators.some((d) => AUTHZ_DECORATOR.test(d))) return true;
  return fn.body.some((l) => {
    const t = l.text;
    if (/abort\(\s*40[34]\s*\)|status_code\s*=\s*40[34]|HTTP_40[34]|Forbidden\(/.test(t) && !/abort\(\s*404\s*\)\s*$/.test(t)) return true;
    if (/\b(check_permission|authorize|has_permission|can_access|is_owner|require_owner|ensure_owner)\s*\(/.test(t)) return true;
    const who = /\b(current_user|g\.user|get_jwt_identity\(\)|session\[|user\.id|user_id\b|owner)/.test(t);
    const compare = /==|!=|\bis not\b|owner_id|user_id\s*=|filter_by\(|WHERE[^"']*\b(user_id|owner_id)\b/i.test(t);
    return who && compare && !/^(def|@)/.test(t);
  });
}

function analyzeAccess(fn: PyFunction, ctx: Ctx) {
  if (!ctx.enabled.access || !fn.route) return;
  const idParams = fn.route.pathParams.filter((p) => /(^id$|_id$|^pk$|uuid|_key$)/i.test(p));
  if (!idParams.length) return;
  const id = idParams[0];
  const idRe = new RegExp(`(?<![\\w.])${id}(?![\\w])`);
  const lookup = fn.body.find((l) => {
    const m = codeOnly(l.text);
    return idRe.test(m) && /\.(execute|get|get_or_404|first_or_404|filter_by|filter|find_one|find|query|select|scalar|one|first)\s*\(|\bopen\s*\(|\bselect\s*\(|get_object_or_404\(/.test(m);
  });
  if (!lookup) return;
  const authz = hasAuthz(fn);
  const authn = hasAuthn(fn);
  if (authz) {
    ctx.safe.push({ file: fn.file, line: lookup.line, fn: fn.name, category: "access", description: `Ownership/permission check observed before returning resource identified by ${id}` });
    return;
  }
  const ruleId = authn ? "FRI-AC-002" : "FRI-AC-001";
  const resource = tableOf(lookup.text) ?? /([A-Z]\w+)\.(query|objects)/.exec(lookup.text)?.[1] ?? /(\w+)\s*=/.exec(lookup.text)?.[1] ?? "resource";
  const route = routeNode(fn);
  route.detail = `${authn ? "Authenticated" : "Public (no authentication observed)"} route ${fn.name}()`;
  const src: GraphNode = { id: nid(fn.file, fn.line, "source", id), kind: "source", label: `path parameter ${id}`, detail: "Client-controlled resource identifier", file: fn.file, line: fn.line, fn: fn.name };
  const look: GraphNode = { id: nid(fn.file, lookup.line, "sink", "lookup"), kind: "sink", label: "Resource lookup by identifier", detail: lookup.text.slice(0, 90), file: fn.file, line: lookup.line, fn: fn.name, vulnerable: true };
  const miss: GraphNode = { id: nid(fn.file, lookup.line, "missing_check", "authz"), kind: "missing_check", label: authn ? "Missing ownership check" : "Missing authentication & authorization", detail: authn ? "The caller is authenticated, but nothing compares the resource owner with the caller." : "No login requirement or ownership comparison was observed for this route.", file: fn.file, line: lookup.line, fn: fn.name };
  const asset: GraphNode = { id: nid(fn.file, lookup.line, "asset", resource), kind: "asset", label: resource === "resource" ? "Requested resource" : `${/^[A-Z]/.test(resource) ? "Model" : "Table"} ${resource}`, detail: "Object returned to the caller", file: fn.file, line: lookup.line, fn: fn.name };
  const nodes = [route, src, look, miss, asset];
  const rels = ["", "accepts", "used in", "not guarded by", "exposes"];
  const edges: GraphEdge[] = nodes.slice(1).map((n, i) => ({ id: `e${i}-${n.id}`, from: nodes[i].id, to: n.id, relation: rels[i + 1] }));
  const sinkCode = lookup.text.replace(/\s+/g, " ").trim();
  const fingerprint = hashString(["access", ruleId, fn.file, fn.name, sinkCode, id].join("|"));
  const { score, severity, factors, confidence } = scoreFinding({
    category: "access", ruleId, publicRoute: !authn, authenticated: authn, reachability: ctx.globalAuthHook ? "uncertain" : "reachable",
    evidence: authn ? "weak" : "moderate", shellSink: false, multiStatement: false, sensitiveAsset: SENSITIVE_ASSET.test(resource), interprocedural: 0, origin: "path_param", globalAuthHook: ctx.globalAuthHook,
  });
  ctx.findings.set(fingerprint, {
    fingerprint, ruleId, category: "access",
    title: authn ? `Possible IDOR in ${fn.name}(): ${resource} fetched by ${id} without ownership check` : `Missing authorization in ${fn.name}(): ${resource} exposed by ${id}`,
    severity, score, confidence, file: fn.file, line: lookup.line, fn: fn.name, route: `${fn.route.methods.join("/")} ${fn.route.path}`,
    reachability: ctx.globalAuthHook ? "uncertain" : "reachable", evidence: authn ? "weak" : "moderate", sinkCode, sourceDesc: `path parameter ${id}`,
    explanation: authn
      ? `Any signed-in user can supply a different ${id} and the handler loads that ${resource} without confirming it belongs to them. This is the classic insecure direct object reference pattern.`
      : `The route accepts ${id} from the URL and returns the matching ${resource}, but FRIDAY found no authentication requirement or ownership check. Anyone who can reach the endpoint could enumerate identifiers.`,
    rationale: `Rule ${ruleId} matches a route whose path parameter ${id} is used in a resource lookup, with ${authn ? "authentication but no comparison between the resource owner and the caller" : "no recognized login decorator, auth dependency, or ownership comparison"}.`,
    steps: nodes.map((n, i) => describeStep(n, rels[i])),
    missingControl: authn ? "No comparison between the resource's owner and the authenticated user (e.g. resource.owner_id == current_user.id) and no 403 response path." : "No authentication requirement (decorator or dependency) and no per-object authorization check.",
    limitations: [
      "Authorization is often enforced in middleware, gateways or database row-level security that static analysis cannot see.",
      ctx.globalAuthHook ? "A global request hook (before_request / router dependencies) exists in this project and may enforce access control — confidence reduced." : "No global request hook was found, but external gateways were not inspected.",
      "Only explicit comparisons, recognized decorators and 403 responses are treated as authorization controls.",
    ],
    factors, nodes, edges,
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface AnalysisResult {
  findings: Finding[];
  safe: SafeObservation[];
  frameworks: string[];
  warnings: string[];
  functionsAnalyzed: number;
  routesFound: number;
  inventory: Record<string, string[]>;
}

export interface AnalyzeHooks {
  onStage?: (stage: "analyzing" | "graph" | "ranking", info: { filesDone: number; findings: number }) => Promise<void> | void;
  isCancelled?: () => boolean;
}

export class ScanCancelled extends Error {}

export async function analyzeProject(files: FileEntry[], enabled: Record<Category, boolean>, hooks: AnalyzeHooks = {}): Promise<AnalysisResult> {
  const pyFiles = files.filter((f) => /\.py$/i.test(f.path));
  const webFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|html|htm|css|scss|less)$/i.test(f.path));

  // Run Web (TypeScript, JavaScript, React, HTML, CSS) Static Analysis
  const webRes = analyzeWebFiles(webFiles);

  const models = new Map<string, FileModel>();
  const warnings: string[] = [];
  let done = 0;
  for (const f of pyFiles) {
    if (hooks.isCancelled?.()) throw new ScanCancelled("cancelled");
    try {
      const m = parseFile(f);
      models.set(f.path, m);
      m.warnings.forEach((w) => warnings.push(`${f.path}: ${w}`));
    } catch (e) {
      warnings.push(`${f.path}: could not be parsed (${(e as Error).message})`);
    }
    done++;
    if (done % 5 === 0 || done === pyFiles.length) await hooks.onStage?.("analyzing", { filesDone: done, findings: 0 });
  }
  const byName = new Map<string, PyFunction>();
  for (const m of models.values()) for (const fn of m.functions) if (!byName.has(fn.name)) byName.set(fn.name, fn);
  const moduleNames = new Set([...models.keys()].map((p) => p.split("/").pop()!.replace(/\.py$/, "")));
  const globalAuthHook = [...models.values()].some((m) => m.lines.some((l) => /^@[\w.]+\.before_request\b/.test(l.text) || /APIRouter\([^)]*dependencies\s*=/.test(l.text) || /FastAPI\([^)]*dependencies\s*=/.test(l.text)));
  const ctx: Ctx = { files: models, byName, moduleNames, findings: new Map(), safe: [], enabled, globalAuthHook, visiting: new Set() };

  await hooks.onStage?.("graph", { filesDone: done, findings: 0 });
  const all = [...models.values()].flatMap((m) => m.functions);
  const routes = all.filter((f) => f.route);
  for (const fn of routes) {
    if (hooks.isCancelled?.()) throw new ScanCancelled("cancelled");
    ctx.entry = fn;
    const initial = new Map<string, Taint>();
    const r = fn.route!;
    for (const p of fn.params) {
      if (p.name === "self" || p.name === "cls") continue;
      const isPath = r.pathParams.includes(p.name);
      const injected = /Depends\(|Request\b|Session\b|BackgroundTasks|Response\b|WebSocket/.test(p.raw);
      if (isPath || (r.framework === "fastapi" && !injected)) {
        const origin: Origin = isPath ? "path_param" : "fastapi_param";
        const desc = isPath ? `path parameter ${p.name}` : `request parameter ${p.name}`;
        const sanitized = /:\s*(int|float|bool|UUID|uuid\.UUID)\b/.test(p.raw);
        const t = newSource(fn, fn.line, desc, origin);
        if (sanitized) { t.sanitizedFor.add("sqli"); t.sanitizedFor.add("cmdi"); }
        if (/<int:/.test(r.path) && new RegExp(`<int:${p.name}>`).test(r.path)) { t.sanitizedFor.add("sqli"); t.sanitizedFor.add("cmdi"); }
        initial.set(p.name, t);
      }
    }
    analyzeFunction(fn, initial, ctx);
    analyzeAccess(fn, ctx);
  }
  for (const fn of all) {
    if (fn.route) continue;
    if (!fn.body.some((l) => /\brequest\.(args|form|values|json|data|cookies|headers|get_json|query_params)|(?<![\w.])input\s*\(|sys\.argv/.test(codeOnly(l.text)))) continue;
    ctx.entry = fn;
    analyzeFunction(fn, new Map(), ctx);
  }

  // Merge Web findings and safe observations
  for (const f of webRes.findings) {
    if (enabled[f.category]) {
      ctx.findings.set(f.fingerprint, f);
    }
  }
  ctx.safe.push(...webRes.safe);

  await hooks.onStage?.("ranking", { filesDone: files.length, findings: ctx.findings.size });

  const inventory: Record<string, string[]> = { ...webRes.inventory };
  for (const m of models.values()) inventory[m.path] = m.functions.map((f) => f.name);
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  const findings = [...ctx.findings.values()].sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  const frameworks = [...new Set([...models.values()].flatMap((m) => [...m.frameworks]), ...webRes.frameworks)];
  // de-duplicate safe observations
  const seen = new Set<string>();
  const safe = ctx.safe.filter((s) => { const k = `${s.file}:${s.line}:${s.category}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { findings, safe, frameworks, warnings, functionsAnalyzed: all.length + webRes.functionsAnalyzed, routesFound: routes.length + webRes.routesFound, inventory };
}

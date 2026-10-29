import type { FileEntry, SkippedEntry } from "./types";

export const LIMITS = {
  archiveBytes: 40 * 1024 * 1024,
  entries: 10000,
  maxFiles: 2000,
  fileBytes: 2 * 1024 * 1024,
  totalBytes: 60 * 1024 * 1024,
};

export const SUPPORTED_EXTENSIONS = /\.(py|ts|tsx|js|jsx|mjs|cjs|html|htm|css|scss|less)$/i;

export const DEFAULT_EXCLUDES = [
  "venv",
  ".venv",
  "env",
  ".env",
  "__pycache__",
  "node_modules",
  ".git",
  "site-packages",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".idea",
  ".vscode",
  "eggs",
  ".eggs",
  "htmlcov",
  ".ruff_cache",
  "coverage",
];

export interface Inventory {
  name: string;
  files: FileEntry[];
  skipped: SkippedEntry[];
  frameworks: string[];
  totalBytes: number;
}

export class IngestError extends Error {}

/** Returns an error reason, or null if the archive entry path is safe. */
export function validateEntryPath(p: string): string | null {
  if (!p || p.includes("\0")) return "Invalid file name";
  if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p)) return "Absolute path rejected";
  const parts = p.replace(/\\/g, "/").split("/");
  if (parts.some((s) => s === "..")) return "Path traversal (..) rejected";
  return null;
}

function excludedBy(path: string, excludes: string[]): string | null {
  const parts = path.split("/");
  for (const seg of parts.slice(0, -1)) if (excludes.includes(seg) || seg.endsWith(".egg-info")) return seg;
  return null;
}

function detectFrameworks(files: FileEntry[]) {
  const s = new Set<string>();
  for (const f of files) {
    if (/^\s*(from\s+flask\b|import\s+flask\b)/m.test(f.content)) s.add("Flask");
    if (/^\s*(from\s+fastapi\b|import\s+fastapi\b)/m.test(f.content)) s.add("FastAPI");
    if (/(from\s+['"]react['"]|require\(['"]react['"]\)|<[A-Z]\w+)/.test(f.content)) s.add("React");
    if (/(from\s+['"]express['"]|require\(['"]express['"]\)|express\(\))/.test(f.content)) s.add("Express");
    if (/(from\s+['"]next['"]|from\s+['"]next\/|next\/image)/.test(f.content)) s.add("Next.js");
    if (/(from\s+['"]vue['"]|createApp\()/.test(f.content)) s.add("Vue");
  }
  return [...s];
}

function looksBinary(s: string) {
  return s.slice(0, 4000).includes("\u0000");
}

function stripCommonRoot(files: FileEntry[]) {
  return files;
}

export async function ingestFiles(input: File[], extraExcludes: string[] = []): Promise<Inventory> {
  const excludes = [...DEFAULT_EXCLUDES, ...extraExcludes.filter(Boolean)];
  if (!input.length) throw new IngestError("No files selected.");
  const zips = input.filter((f) => /\.zip$/i.test(f.name));
  if (zips.length > 1) throw new IngestError("Upload one ZIP archive at a time.");
  if (zips.length === 1 && input.length > 1) throw new IngestError("Upload either one ZIP archive or source files, not both.");

  const files: FileEntry[] = [];
  const skipped: SkippedEntry[] = [];
  let totalBytes = 0;
  let name = "Uploaded files";

  if (zips.length) {
    const zip = zips[0];
    name = zip.name.replace(/\.zip$/i, "");
    if (zip.size > LIMITS.archiveBytes) throw new IngestError(`Archive is ${(zip.size / 1048576).toFixed(1)} MB; the limit is ${LIMITS.archiveBytes / 1048576} MB.`);
    const head = new Uint8Array(await zip.slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new IngestError("This file is not a valid ZIP archive (missing ZIP signature).");
    const JSZip = (await import("jszip")).default;
    let archive: import("jszip");
    try {
      archive = await JSZip.loadAsync(zip);
    } catch (e) {
      throw new IngestError(`The archive could not be read: ${(e as Error).message}. It may be corrupted or encrypted.`);
    }
    const entries = Object.values(archive.files);
    if (entries.length > LIMITS.entries) throw new IngestError(`Archive contains ${entries.length} entries; the limit is ${LIMITS.entries}.`);
    let declared = 0;
    for (const e of entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      declared += ((e as any)._data?.uncompressedSize as number) ?? 0;
    }
    if (declared > LIMITS.totalBytes * 4) throw new IngestError("Archive expands to an unsafe size (possible zip bomb).");
    for (const e of entries) {
      if (e.dir) continue;
      const path = e.name.replace(/\\/g, "/");
      const bad = validateEntryPath(path);
      if (bad) { skipped.push({ path, reason: bad }); continue; }
      const mode = (e.unixPermissions as number | null) ?? 0;
      if ((mode & 0o170000) === 0o120000) { skipped.push({ path, reason: "Symbolic link rejected" }); continue; }
      if (path.startsWith("__MACOSX/") || path.split("/").pop()!.startsWith("._")) { skipped.push({ path, reason: "OS metadata" }); continue; }
      const ex = excludedBy(path, excludes);
      if (ex) { skipped.push({ path, reason: `Excluded directory (${ex})` }); continue; }
      if (!SUPPORTED_EXTENSIONS.test(path)) { skipped.push({ path, reason: "Unsupported file type" }); continue; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const size = ((e as any)._data?.uncompressedSize as number) ?? 0;
      if (size > LIMITS.fileBytes) { skipped.push({ path, reason: "File larger than 2 MB" }); continue; }
      if (files.length >= LIMITS.maxFiles) { skipped.push({ path, reason: "Maximum file count reached" }); continue; }
      const content = await e.async("string");
      if (content.length > LIMITS.fileBytes) { skipped.push({ path, reason: "File larger than 2 MB" }); continue; }
      if (looksBinary(content)) { skipped.push({ path, reason: "Binary content" }); continue; }
      totalBytes += content.length;
      if (totalBytes > LIMITS.totalBytes) throw new IngestError("Total extracted source exceeds 60 MB.");
      files.push({ path, content, size: content.length });
    }
  } else {
    for (const f of input) {
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const bad = validateEntryPath(path);
      if (bad) { skipped.push({ path, reason: bad }); continue; }
      const ex = excludedBy(path, excludes);
      if (ex) { skipped.push({ path, reason: `Excluded directory (${ex})` }); continue; }
      if (!SUPPORTED_EXTENSIONS.test(f.name)) { skipped.push({ path, reason: "Unsupported file type (supported: .py, .ts, .tsx, .js, .jsx, .html, .css)" }); continue; }
      if (f.size > LIMITS.fileBytes) { skipped.push({ path, reason: "File larger than 2 MB" }); continue; }
      if (files.length >= LIMITS.maxFiles) { skipped.push({ path, reason: "Maximum file count reached" }); continue; }
      const content = await f.text();
      if (looksBinary(content)) { skipped.push({ path, reason: "Binary content" }); continue; }
      totalBytes += content.length;
      files.push({ path, content, size: content.length });
    }
    if (files.length === 1) name = files[0].path.replace(/\.[A-Za-z0-9]+$/, "");
  }
  if (!files.length) throw new IngestError(skipped.length ? `No analyzable source files found (${skipped.length} file${skipped.length > 1 ? "s" : ""} skipped). FRIDAY supports Python, TypeScript, JavaScript, React (.tsx/.jsx), HTML, and CSS.` : "The upload is empty.");
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { name, files: stripCommonRoot(files), skipped, frameworks: detectFrameworks(files), totalBytes };
}

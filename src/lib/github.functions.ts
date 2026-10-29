import { createServerFn } from "@tanstack/react-start";
import { parseGitHubUrl } from "./friday/github";
import { DEFAULT_EXCLUDES, SUPPORTED_EXTENSIONS, LIMITS } from "./friday/ingest";
import type { FileEntry, SkippedEntry } from "./friday/types";

export interface ServerFetchRepoInput {
  url: string;
  token?: string;
  branch?: string;
}

export interface ServerFetchRepoResult {
  name: string;
  files: FileEntry[];
  skipped: SkippedEntry[];
  frameworks: string[];
  totalBytes: number;
  error?: string;
}

export const fetchGitHubRepoServer = createServerFn({ method: "POST" })
  .validator((d: ServerFetchRepoInput): ServerFetchRepoInput => {
    if (!d || typeof d.url !== "string" || !d.url.trim()) {
      throw new Error("Repository URL is required.");
    }
    return {
      url: d.url.trim(),
      token: d.token ? d.token.trim() : undefined,
      branch: d.branch ? d.branch.trim() : undefined,
    };
  })
  .handler(async ({ data }): Promise<ServerFetchRepoResult> => {
    const parsed = parseGitHubUrl(data.url);
    if (!parsed) {
      return {
        name: "",
        files: [],
        skipped: [],
        frameworks: [],
        totalBytes: 0,
        error: "Invalid GitHub repository URL. Use format: https://github.com/owner/repo",
      };
    }

    const { owner, repo } = parsed;
    let branch = data.branch || parsed.branch;

    const headers: Record<string, string> = {
      "User-Agent": "Friday-Security-Server",
    };
    if (data.token) {
      headers.Authorization = `Bearer ${data.token}`;
    }

    if (!branch) {
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { default_branch?: string };
          if (meta.default_branch) {
            branch = meta.default_branch;
          }
        }
      } catch {
        // Fallback to main
      }
    }
    if (!branch) branch = "main";

    // Download repository ZIP from GitHub codeload or API
    let zipRes = await fetch(
      `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
      { headers }
    );

    if (!zipRes.ok && branch === "main") {
      // Fallback to master branch
      zipRes = await fetch(
        `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`,
        { headers }
      );
      if (zipRes.ok) {
        branch = "master";
      }
    }

    if (!zipRes.ok) {
      return {
        name: `${owner}/${repo}`,
        files: [],
        skipped: [],
        frameworks: [],
        totalBytes: 0,
        error: `Could not download repository archive (HTTP ${zipRes.status}). Verify the repository is public or provide an access token.`,
      };
    }

    const arrayBuffer = await zipRes.arrayBuffer();
    const JSZip = (await import("jszip")).default;
    const archive = await JSZip.loadAsync(arrayBuffer);

    const files: FileEntry[] = [];
    const skipped: SkippedEntry[] = [];
    let totalBytes = 0;
    const excludes = DEFAULT_EXCLUDES;

    const entries = Object.values(archive.files);
    for (const e of entries) {
      if (e.dir) continue;
      // Strip outer root folder from zip (e.g. repo-main/path/to/file.py -> path/to/file.py)
      const pathParts = e.name.replace(/\\/g, "/").split("/");
      if (pathParts.length <= 1) continue;
      const cleanPath = pathParts.slice(1).join("/");

      const isExcluded = pathParts.slice(1, -1).some((seg) => excludes.includes(seg));
      if (isExcluded) {
        skipped.push({ path: cleanPath, reason: "Excluded directory" });
        continue;
      }

      if (!SUPPORTED_EXTENSIONS.test(cleanPath)) {
        skipped.push({ path: cleanPath, reason: "Unsupported file extension" });
        continue;
      }

      const content = await e.async("string");
      if (content.length > LIMITS.fileBytes) {
        skipped.push({ path: cleanPath, reason: "Exceeds 2 MB limit" });
        continue;
      }

      if (content.slice(0, 4000).includes("\u0000")) {
        skipped.push({ path: cleanPath, reason: "Binary content" });
        continue;
      }

      totalBytes += content.length;
      files.push({
        path: cleanPath,
        content,
        size: content.length,
      });

      if (files.length >= LIMITS.maxFiles) break;
    }

    // Detect frameworks
    const frameworks = new Set<string>();
    for (const f of files) {
      if (/^\s*(from\s+flask\b|import\s+flask\b)/m.test(f.content)) frameworks.add("Flask");
      if (/^\s*(from\s+fastapi\b|import\s+fastapi\b)/m.test(f.content)) frameworks.add("FastAPI");
      if (/(from\s+['"]react['"]|require\(['"]react['"]\)|<[A-Z]\w+)/.test(f.content)) frameworks.add("React");
      if (/(from\s+['"]express['"]|require\(['"]express['"]\)|express\(\))/.test(f.content)) frameworks.add("Express");
      if (/(from\s+['"]next['"]|from\s+['"]next\/|next\/image)/.test(f.content)) frameworks.add("Next.js");
      if (/(from\s+['"]vue['"]|createApp\()/.test(f.content)) frameworks.add("Vue");
    }

    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
      name: `${owner}/${repo}`,
      files,
      skipped,
      frameworks: [...frameworks],
      totalBytes,
    };
  });


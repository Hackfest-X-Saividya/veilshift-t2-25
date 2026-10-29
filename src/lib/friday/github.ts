import { SUPPORTED_EXTENSIONS, DEFAULT_EXCLUDES, LIMITS, type Inventory } from "./ingest";
import type { FileEntry, SkippedEntry } from "./types";

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
}

/**
 * Parses various GitHub URL formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/branch/sub/path
 * - https://github.com/owner/repo/blob/branch/path/to/file.py
 * - git@github.com:owner/repo.git
 * - owner/repo
 * Handles trailing slashes, query parameters (?tab=...), and hashes (#readme).
 */
export function parseGitHubUrl(input: string): GitHubRepoRef | null {
  if (!input) return null;
  // 1. Strip query parameters, URL hash fragments, and trailing slashes
  const clean = input.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");

  // 2. Handle SSH format: git@github.com:owner/repo(.git)
  const sshMatch = clean.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  // 3. Handle standard HTTP/HTTPS/github.com URLs (supporting both /tree/ and /blob/)
  const urlMatch = clean.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^\/]+)(?:\/(.*))?)?$/
  );

  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      branch: urlMatch[3] || undefined,
      subpath: urlMatch[4] ? urlMatch[4].replace(/\/+$/, "") : undefined,
    };
  }

  // 4. Match owner/repo short format
  const shortMatch = clean.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }

  return null;
}

export interface FetchRepoOptions {
  token?: string;
  maxFiles?: number;
  onProgress?: (status: string, current?: number, total?: number) => void;
}

export async function fetchGitHubRepo(
  repoRef: GitHubRepoRef,
  options: FetchRepoOptions = {}
): Promise<Inventory> {
  const { owner, repo, branch: specifiedBranch, subpath } = repoRef;
  const { token, maxFiles = 300, onProgress } = options;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Friday-Security-Scanner",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  onProgress?.(`Contacting GitHub API for ${owner}/${repo}...`);

  // 1. Fetch Repo Metadata (resolve default branch if not specified)
  let branch = specifiedBranch;
  let repoName = `${owner}/${repo}`;
  try {
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!metaRes.ok) {
      if (metaRes.status === 404) {
        throw new Error(`GitHub repository '${owner}/${repo}' was not found. Please check spelling or verify it is a public repository.`);
      }
      if (metaRes.status === 403 && metaRes.headers.get("x-ratelimit-remaining") === "0") {
        throw new Error("GitHub API rate limit exceeded for this IP. Provide a GitHub Personal Access Token to continue.");
      }
      throw new Error(`GitHub API error: ${metaRes.status} ${metaRes.statusText}`);
    }
    const meta = await metaRes.json();
    if (!branch) {
      branch = meta.default_branch || "main";
    }
    repoName = meta.name || repo;
  } catch (err: any) {
    if (err.message?.includes("not found") || err.message?.includes("rate limit")) {
      throw err;
    }
    // Fallback default branch to main if metadata lookup fails
    if (!branch) branch = "main";
  }

  onProgress?.(`Fetching repository tree structure (branch: ${branch})...`);

  // 2. Fetch Git Recursive Tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    // If main failed and not specified, try 'master' as fallback
    if (!specifiedBranch && branch === "main") {
      const fallbackTreeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        { headers }
      );
      if (fallbackTreeRes.ok) {
        branch = "master";
        return fetchWithTreeResponse(fallbackTreeRes, owner, repo, branch, repoName, subpath, headers, maxFiles, onProgress);
      }
    }
    if (treeRes.status === 403 && treeRes.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("GitHub API rate limit reached. Provide a personal access token for higher limits.");
    }
    throw new Error(`Failed to load repository tree for branch '${branch}' (${treeRes.status}).`);
  }

  return fetchWithTreeResponse(treeRes, owner, repo, branch, repoName, subpath, headers, maxFiles, onProgress);
}

async function fetchWithTreeResponse(
  treeRes: Response,
  owner: string,
  repo: string,
  branch: string,
  repoName: string,
  subpath: string | undefined,
  headers: Record<string, string>,
  maxFiles: number,
  onProgress?: (status: string, current?: number, total?: number) => void
): Promise<Inventory> {
  const treeData = await treeRes.json();
  const rawItems: Array<{ path: string; type: string; size?: number }> = treeData.tree || [];

  const excludes = DEFAULT_EXCLUDES;
  const skipped: SkippedEntry[] = [];
  const filesToFetch: Array<{ path: string; size: number }> = [];

  for (const item of rawItems) {
    if (item.type !== "blob") continue;

    // Apply subpath filter if user specified a subdirectory or single file
    if (subpath && item.path !== subpath && !item.path.startsWith(subpath + "/")) continue;

    const relPath = subpath
      ? (item.path === subpath ? item.path.split("/").pop()! : item.path.slice(subpath.length).replace(/^\/+/, ""))
      : item.path;
    const parts = relPath.split("/");

    // Check directory exclusions
    const isExcluded = parts.slice(0, -1).some((seg) => excludes.includes(seg) || seg.endsWith(".egg-info"));
    if (isExcluded) {
      skipped.push({ path: relPath, reason: "Excluded directory" });
      continue;
    }

    // Check supported file extensions
    if (!SUPPORTED_EXTENSIONS.test(relPath)) {
      skipped.push({ path: relPath, reason: "Unsupported file extension" });
      continue;
    }

    // Size limit
    if (item.size && item.size > LIMITS.fileBytes) {
      skipped.push({ path: relPath, reason: "File exceeds 2 MB limit" });
      continue;
    }

    filesToFetch.push({ path: item.path, size: item.size || 0 });
    if (filesToFetch.length >= maxFiles) break;
  }

  if (filesToFetch.length === 0) {
    throw new Error(`No analyzable code files (.py, .ts, .tsx, .js, .jsx, .html, .css) found in GitHub repository ${owner}/${repo}.`);
  }

  onProgress?.(`Downloading ${filesToFetch.length} source code files in real-time...`, 0, filesToFetch.length);

  // 3. Concurrently fetch raw file contents
  const files: FileEntry[] = [];
  let totalBytes = 0;
  let completed = 0;
  const concurrency = 6;

  for (let i = 0; i < filesToFetch.length; i += concurrency) {
    const chunk = filesToFetch.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (target) => {
        try {
          // Fetch from raw.githubusercontent.com (CORS friendly and high throughput)
          const encodedPath = target.path.split("/").map(encodeURIComponent).join("/");
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
          const res = await fetch(rawUrl);
          if (!res.ok) {
            skipped.push({ path: target.path, reason: `Failed to download (${res.status})` });
            return;
          }
          const content = await res.text();
          if (content.slice(0, 4000).includes("\u0000")) {
            skipped.push({ path: target.path, reason: "Binary content" });
            return;
          }

          totalBytes += content.length;
          files.push({
            path: subpath ? target.path.slice(subpath.length).replace(/^\/+/, "") : target.path,
            content,
            size: content.length,
          });
        } catch (e: any) {
          skipped.push({ path: target.path, reason: `Network error: ${e.message}` });
        } finally {
          completed++;
          onProgress?.(
            `Downloading repository files (${completed}/${filesToFetch.length})...`,
            completed,
            filesToFetch.length
          );
        }
      })
    );
  }

  if (files.length === 0) {
    throw new Error("Could not download any valid source files from the repository.");
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
    name: repoName,
    files,
    skipped,
    frameworks: [...frameworks],
    totalBytes,
  };
}


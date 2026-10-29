import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./github";

describe("GitHub URL Parser", () => {
  it("parses standard https://github.com/owner/repo URLs", () => {
    const res = parseGitHubUrl("https://github.com/OWASP/NodeGoat");
    expect(res).not.toBeNull();
    expect(res?.owner).toBe("OWASP");
    expect(res?.repo).toBe("NodeGoat");
    expect(res?.branch).toBeUndefined();
  });

  it("parses URLs with .git suffix", () => {
    const res = parseGitHubUrl("https://github.com/pallets/flask.git");
    expect(res?.owner).toBe("pallets");
    expect(res?.repo).toBe("flask");
  });

  it("parses URLs with branch specifications", () => {
    const res = parseGitHubUrl("https://github.com/expressjs/express/tree/master");
    expect(res?.owner).toBe("expressjs");
    expect(res?.repo).toBe("express");
    expect(res?.branch).toBe("master");
  });

  it("parses URLs with branch and subfolder", () => {
    const res = parseGitHubUrl("https://github.com/facebook/react/tree/main/packages/react");
    expect(res?.owner).toBe("facebook");
    expect(res?.repo).toBe("react");
    expect(res?.branch).toBe("main");
    expect(res?.subpath).toBe("packages/react");
  });

  it("parses single file blob URLs", () => {
    const res = parseGitHubUrl("https://github.com/pallets/flask/blob/main/src/flask/app.py");
    expect(res?.owner).toBe("pallets");
    expect(res?.repo).toBe("flask");
    expect(res?.branch).toBe("main");
    expect(res?.subpath).toBe("src/flask/app.py");
  });

  it("handles URLs with query params, hashes, and trailing slashes", () => {
    const res = parseGitHubUrl("https://github.com/pallets/flask/?tab=readme-ov-file#readme");
    expect(res?.owner).toBe("pallets");
    expect(res?.repo).toBe("flask");
  });

  it("parses SSH git@github.com URLs", () => {
    const res = parseGitHubUrl("git@github.com:pallets/flask.git");
    expect(res?.owner).toBe("pallets");
    expect(res?.repo).toBe("flask");
  });

  it("parses shorthand owner/repo notation", () => {
    const res = parseGitHubUrl("vercel/next.js");
    expect(res?.owner).toBe("vercel");
    expect(res?.repo).toBe("next.js");
  });

  it("returns null for non-github URLs", () => {
    expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseGitHubUrl("")).toBeNull();
    expect(parseGitHubUrl("random text")).toBeNull();
  });
});


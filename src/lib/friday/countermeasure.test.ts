import { describe, expect, it } from "vitest";
import { simulate } from "./countermeasure";

describe("Countermeasure Lab", () => {
  it("SQL tautology breaches without defenses", () => {
    expect(simulate("sqli", "' OR '1'='1", new Set()).outcome).toBe("breached");
  });
  it("parameterised query contains SQL injection", () => {
    const r = simulate("sqli", "' OR '1'='1", new Set(["param"]));
    expect(r.outcome).toBe("contained");
    expect(r.stoppedBy).toBe("Parameterised query");
  });
  it("argv list contains command chaining", () => {
    expect(simulate("cmdi", "x; cat /etc/passwd", new Set(["argv"])).outcome).toBe("contained");
    expect(simulate("cmdi", "x; cat /etc/passwd", new Set()).outcome).toBe("breached");
  });
  it("ownership check blocks other users' IDs but allows own", () => {
    expect(simulate("access", "1002", new Set(["ownership"])).outcome).toBe("contained");
    expect(simulate("access", "1001", new Set(["ownership"])).outcome).toBe("benign");
    expect(simulate("access", "1002", new Set()).outcome).toBe("breached");
  });
});

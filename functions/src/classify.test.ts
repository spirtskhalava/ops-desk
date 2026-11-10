import { describe, expect, it } from "vitest";
import { classifyByRules, parseModelAnswer } from "./classify";

describe("classifyByRules", () => {
  it("picks billing and bumps priority", () => {
    expect(classifyByRules("Client was charged twice for the same invoice")).toMatchObject({
      category: "billing",
      priority: "high",
    });
  });

  it("detects urgent wording", () => {
    expect(classifyByRules("CRM is down, nobody can log in").priority).toBe("urgent");
  });

  it("works with georgian text", () => {
    expect(classifyByRules("პრინტერი არ ბეჭდავს").category).toBe("hardware");
  });
});

describe("parseModelAnswer", () => {
  it("accepts json wrapped in text", () => {
    expect(parseModelAnswer('Sure: {"category":"bug","priority":"low"}')).toEqual({
      category: "bug",
      priority: "low",
      source: "ai",
    });
  });

  it("rejects unknown values", () => {
    expect(parseModelAnswer('{"category":"cats","priority":"low"}')).toBeNull();
  });
});

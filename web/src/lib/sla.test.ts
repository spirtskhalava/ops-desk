import { describe, expect, it } from "vitest";
import { slaState, timeLeft } from "./sla";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 9, h, m));

describe("slaState", () => {
  it("is ok early in the window", () => expect(slaState(at(9), at(13), at(10))).toBe("ok"));
  it("warns in the last 20%", () => expect(slaState(at(9), at(13), at(12, 30))).toBe("soon"));
  it("breached after due time", () => expect(slaState(at(9), at(13), at(13, 1))).toBe("breached"));
  it("trusts the server flag", () => expect(slaState(at(9), at(13), at(10), true)).toBe("breached"));
});

describe("timeLeft", () => {
  it("formats minutes, hours and overdue", () => {
    expect(timeLeft(at(10, 45), at(10))).toBe("45m");
    expect(timeLeft(at(13, 30), at(10))).toBe("3h 30m");
    expect(timeLeft(at(10), at(10, 20))).toBe("20m over");
  });
});

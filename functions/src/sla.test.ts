import { describe, expect, it } from "vitest";
import { slaDueDate } from "./sla";

// Tbilisi is UTC+4, so 09:00 local = 05:00Z
describe("slaDueDate", () => {
  it("urgent ignores working hours", () => {
    const created = new Date("2026-11-07T20:00:00Z"); // Saturday night
    expect(slaDueDate(created, "urgent").toISOString()).toBe("2026-11-07T20:30:00.000Z");
  });

  it("high priority inside working hours", () => {
    const created = new Date("2026-11-09T07:00:00Z"); // Mon 11:00 local
    expect(slaDueDate(created, "high").toISOString()).toBe("2026-11-09T11:00:00.000Z");
  });

  it("carries over to the next working day", () => {
    const created = new Date("2026-11-09T13:00:00Z"); // Mon 17:00 local, 2h left today
    // 4h SLA -> 2h Monday + 2h Tuesday from 09:00 -> Tue 11:00 local
    expect(slaDueDate(created, "high").toISOString()).toBe("2026-11-10T07:00:00.000Z");
  });

  it("friday evening rolls to monday", () => {
    const created = new Date("2026-11-13T16:00:00Z"); // Fri 20:00 local
    expect(slaDueDate(created, "high").toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });
});

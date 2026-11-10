import type { Priority } from "./types";

// First-response targets in minutes. Agreed with the ops leads,
// "urgent" means production is down or money is stuck.
export const SLA_MINUTES: Record<Priority, number> = {
  urgent: 30,
  high: 4 * 60,
  normal: 24 * 60,
  low: 3 * 24 * 60,
};

const WORK_START = 9;
const WORK_END = 19;

/**
 * Adds SLA minutes counting only working hours (Mon-Fri, 09-19 local).
 * Urgent tickets ignore working hours - someone is always on call for those.
 */
export function slaDueDate(createdAt: Date, priority: Priority, tzOffsetMin = 240): Date {
  const minutes = SLA_MINUTES[priority];
  if (priority === "urgent") return new Date(createdAt.getTime() + minutes * 60_000);

  // work in "local" time by shifting, then shift back at the end
  let t = new Date(createdAt.getTime() + tzOffsetMin * 60_000);
  let left = minutes;

  while (left > 0) {
    const day = t.getUTCDay();
    const hour = t.getUTCHours() + t.getUTCMinutes() / 60;

    if (day === 0 || day === 6 || hour >= WORK_END) {
      t = nextWorkStart(t);
      continue;
    }
    if (hour < WORK_START) {
      t.setUTCHours(WORK_START, 0, 0, 0);
      continue;
    }

    const minsToClose = Math.round((WORK_END - hour) * 60);
    const step = Math.min(left, minsToClose);
    t = new Date(t.getTime() + step * 60_000);
    left -= step;
  }

  return new Date(t.getTime() - tzOffsetMin * 60_000);
}

function nextWorkStart(t: Date): Date {
  const n = new Date(t);
  n.setUTCDate(n.getUTCDate() + 1);
  n.setUTCHours(WORK_START, 0, 0, 0);
  while (n.getUTCDay() === 0 || n.getUTCDay() === 6) n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

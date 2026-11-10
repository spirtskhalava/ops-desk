export type SlaState = "ok" | "soon" | "breached" | "none";

/** "soon" = less than 20% of the window left, but at least 15 minutes warning */
export function slaState(createdAt: Date, dueAt: Date | undefined, now: Date, breached?: boolean): SlaState {
  if (!dueAt) return "none";
  if (breached || now >= dueAt) return "breached";
  const total = dueAt.getTime() - createdAt.getTime();
  const left = dueAt.getTime() - now.getTime();
  return left < Math.max(total * 0.2, 15 * 60_000) ? "soon" : "ok";
}

export function timeLeft(dueAt: Date, now: Date): string {
  const diff = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(diff);
  const text = abs < 60 ? `${abs}m` : abs < 48 * 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${Math.floor(abs / 1440)}d`;
  return diff < 0 ? `${text} over` : text;
}

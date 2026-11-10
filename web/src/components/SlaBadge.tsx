import { slaState, timeLeft } from "../lib/sla";
import type { Ticket } from "../lib/types";

export function SlaBadge({ ticket, now }: { ticket: Ticket; now: Date }) {
  if (ticket.status === "resolved" || ticket.status === "waiting") return null;
  const due = ticket.slaDueAt?.toDate();
  const state = slaState(ticket.createdAt.toDate(), due, now, ticket.slaBreached);
  if (state === "none" || !due) return <span className="sla sla-none">triaging…</span>;
  return <span className={`sla sla-${state}`}>{timeLeft(due, now)}</span>;
}

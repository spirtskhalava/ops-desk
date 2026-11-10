import type { Ticket } from "../lib/types";
import { SlaBadge } from "./SlaBadge";

interface Props {
  ticket: Ticket;
  now: Date;
  draggable: boolean;
  onOpen: (id: string) => void;
}

export function TicketCard({ ticket, now, draggable, onOpen }: Props) {
  return (
    <article
      className={`card prio-${ticket.priority}`}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/ticket-id", ticket.id)}
      onClick={() => onOpen(ticket.id)}
    >
      <header>
        <span className="channel">{ticket.channel === "whatsapp" ? "WA" : "Web"}</span>
        {ticket.category && <span className="tag">{ticket.category}</span>}
        <SlaBadge ticket={ticket} now={now} />
      </header>
      <h3>{ticket.title}</h3>
      <footer>
        <span>{ticket.requesterName}</span>
        <span className="prio">{ticket.priority}</span>
      </footer>
    </article>
  );
}

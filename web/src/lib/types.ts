import type { Timestamp } from "firebase/firestore";

export type TicketStatus = "new" | "open" | "waiting" | "resolved";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Role = "requester" | "agent" | "lead";

export interface Ticket {
  id: string;
  title: string;
  body: string;
  status: TicketStatus;
  priority: Priority;
  category?: string;
  channel: "web" | "whatsapp";
  requesterName: string;
  contactPhone?: string;
  assigneeId: string | null;
  slaDueAt?: Timestamp;
  slaBreached?: boolean;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  body: string;
  direction: "inbound" | "outbound" | "internal";
  authorName: string;
  createdAt: Timestamp;
}

export const COLUMNS: Array<{ status: TicketStatus; label: string }> = [
  { status: "new", label: "New" },
  { status: "open", label: "Open" },
  { status: "waiting", label: "Waiting on customer" },
  { status: "resolved", label: "Resolved" },
];

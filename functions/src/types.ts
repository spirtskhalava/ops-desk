import type { Timestamp } from "firebase-admin/firestore";

export type TicketStatus = "new" | "open" | "waiting" | "resolved";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Channel = "web" | "whatsapp";

export interface Ticket {
  title: string;
  body: string;
  status: TicketStatus;
  priority: Priority;
  category?: string;
  channel: Channel;
  requesterId?: string;
  requesterName: string;
  contactPhone?: string;
  assigneeId: string | null;
  slaDueAt?: Timestamp;
  slaBreached?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessageAt?: Timestamp;
}

export interface Message {
  body: string;
  direction: "inbound" | "outbound" | "internal";
  authorId?: string;
  authorName: string;
  waMessageId?: string;
  createdAt: Timestamp;
}

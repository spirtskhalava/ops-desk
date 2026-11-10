import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { auth, db, functions } from "../lib/firebase";
import type { Message, Ticket } from "../lib/types";

const reply = httpsCallable<{ ticketId: string; body: string }, { ok: boolean }>(functions, "replyToTicket");

interface Props {
  ticket: Ticket;
  isStaff: boolean;
  onClose: () => void;
}

export function TicketPanel({ ticket, isStaff, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(query(collection(db, "tickets", ticket.id, "messages"), orderBy("createdAt")), (snap) =>
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) }))),
      ),
    [ticket.id],
  );

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (internal) {
        const u = auth.currentUser!;
        await addDoc(collection(db, "tickets", ticket.id, "messages"), {
          body: text.trim(),
          direction: "internal",
          authorId: u.uid,
          authorName: u.displayName ?? "Agent",
          createdAt: serverTimestamp(),
        });
      } else {
        await reply({ ticketId: ticket.id, body: text });
      }
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const assignToMe = () =>
    updateDoc(doc(db, "tickets", ticket.id), { assigneeId: auth.currentUser?.uid, status: "open", updatedAt: serverTimestamp() });

  const resolve = () => updateDoc(doc(db, "tickets", ticket.id), { status: "resolved", updatedAt: serverTimestamp() });

  return (
    <aside className="panel">
      <header>
        <button className="ghost" onClick={onClose}>×</button>
        <h2>{ticket.title}</h2>
        <p className="meta">
          {ticket.requesterName}
          {ticket.contactPhone && ` · +${ticket.contactPhone}`} · {ticket.category ?? "uncategorized"} · {ticket.priority}
        </p>
        {isStaff && (
          <div className="row">
            {ticket.assigneeId !== auth.currentUser?.uid && <button onClick={assignToMe}>Take it</button>}
            {ticket.status !== "resolved" && <button className="ghost" onClick={resolve}>Resolve</button>}
          </div>
        )}
      </header>

      <div className="thread">
        {ticket.body && <div className="msg inbound">{ticket.body}</div>}
        {messages
          .filter((m) => !(m.direction === "inbound" && m.body === ticket.body))
          .filter((m) => isStaff || m.direction !== "internal")
          .map((m) => (
            <div key={m.id} className={`msg ${m.direction}`}>
              <small>{m.authorName}{m.direction === "internal" && " · internal note"}</small>
              {m.body}
            </div>
          ))}
      </div>

      {isStaff && (
        <footer className="composer">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={internal ? "Note for the team (customer won't see it)" : ticket.channel === "whatsapp" ? "Reply goes to WhatsApp" : "Reply"} />
          <div className="row">
            <label><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> internal note</label>
            <button disabled={sending || !text.trim()} onClick={send}>{sending ? "…" : "Send"}</button>
          </div>
          {error && <p className="error">{error}</p>}
        </footer>
      )}
    </aside>
  );
}

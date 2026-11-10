import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useMemo, useState } from "react";
import { NewTicketForm } from "../components/NewTicketForm";
import { TicketCard } from "../components/TicketCard";
import { TicketPanel } from "../components/TicketPanel";
import { useNow } from "../hooks/useNow";
import { useTickets } from "../hooks/useTickets";
import { auth, db } from "../lib/firebase";
import { COLUMNS, type TicketStatus } from "../lib/types";

const PRIO_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export function Board({ isStaff }: { isStaff: boolean }) {
  const uid = auth.currentUser?.uid;
  const { tickets, error } = useTickets(uid, isStaff);
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => !mineOnly || t.assigneeId === uid)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.requesterName.toLowerCase().includes(q))
      // most urgent first, then whoever is closest to breaching
      .sort((a, b) =>
        PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] ||
        (a.slaDueAt?.toMillis() ?? Infinity) - (b.slaDueAt?.toMillis() ?? Infinity));
  }, [tickets, mineOnly, search, uid]);

  const breached = tickets.filter((t) => t.slaBreached && t.status !== "resolved").length;
  const opened = tickets.find((t) => t.id === openId);

  async function move(id: string, status: TicketStatus) {
    await updateDoc(doc(db, "tickets", id), { status, updatedAt: serverTimestamp() });
  }

  return (
    <main className="board-page">
      <div className="toolbar">
        <input placeholder="Search title or person" value={search} onChange={(e) => setSearch(e.target.value)} />
        {isStaff && (
          <label><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> assigned to me</label>
        )}
        {breached > 0 && <span className="sla sla-breached">{breached} over SLA</span>}
        <button onClick={() => setCreating(true)}>New ticket</button>
      </div>
      {error && <p className="error">{error}</p>}
      {creating && <NewTicketForm onDone={() => setCreating(false)} />}

      <div className="board">
        {COLUMNS.map((col) => {
          const items = visible.filter((t) => t.status === col.status);
          return (
            <section
              key={col.status}
              className="column"
              onDragOver={(e) => isStaff && e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/ticket-id");
                if (id) move(id, col.status);
              }}
            >
              <h2>{col.label} <span>{items.length}</span></h2>
              {items.map((t) => (
                <TicketCard key={t.id} ticket={t} now={now} draggable={isStaff} onOpen={setOpenId} />
              ))}
            </section>
          );
        })}
      </div>

      {opened && <TicketPanel ticket={opened} isStaff={isStaff} onClose={() => setOpenId(null)} />}
    </main>
  );
}

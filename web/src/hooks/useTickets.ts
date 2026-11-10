import { collection, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import type { Ticket } from "../lib/types";

/** Staff see everything, requesters only their own tickets (rules enforce the same). */
export function useTickets(uid: string | undefined, isStaff: boolean) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const constraints: QueryConstraint[] = isStaff
      ? [orderBy("createdAt", "desc")]
      : [where("requesterId", "==", uid), orderBy("createdAt", "desc")];

    return onSnapshot(
      query(collection(db, "tickets"), ...constraints),
      (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Ticket, "id">) }))),
      (err) => setError(err.message),
    );
  }, [uid, isStaff]);

  return { tickets, error };
}

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { auth, db } from "../lib/firebase";
import type { Priority } from "../lib/types";

export function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "tickets"), {
        title: title.trim(),
        body: body.trim(),
        priority,
        status: "new",
        channel: "web",
        requesterId: user.uid,
        requesterName: user.displayName ?? user.email ?? "Unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="new-ticket" onSubmit={submit}>
      <input placeholder="What's wrong?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea placeholder="Details, links, what you already tried" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <label>
        How blocked are you?
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="low">Just a question</option>
          <option value="normal">Annoying, but I can work</option>
          <option value="high">I can't do part of my job</option>
          <option value="urgent">Nobody can work / money stuck</option>
        </select>
      </label>
      <div className="row">
        <button type="button" className="ghost" onClick={onDone}>Cancel</button>
        <button disabled={saving || !title.trim()}>{saving ? "Sending…" : "Create ticket"}</button>
      </div>
    </form>
  );
}

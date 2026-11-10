import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

import { classify } from "./classify";
import { slaDueDate } from "./sla";
import type { Message, Ticket } from "./types";
import { extractTextMessages, sendText, verifySignature } from "./whatsapp";

initializeApp();
const db = getFirestore();

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
const WA_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WA_APP_SECRET = defineSecret("WHATSAPP_APP_SECRET");
const WA_VERIFY_TOKEN = defineString("WHATSAPP_VERIFY_TOKEN");
const WA_PHONE_ID = defineString("WHATSAPP_PHONE_NUMBER_ID");

const REGION = "europe-west3";

/**
 * Every new ticket (web form or WhatsApp) gets a category, a priority
 * and an SLA deadline. Priority from the requester is kept if it's higher
 * than what the classifier suggests - people know when they're blocked.
 */
export const onTicketCreated = onDocumentCreated(
  { document: "tickets/{ticketId}", region: REGION, secrets: [ANTHROPIC_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const t = snap.data() as Ticket;

    const result = await classify(`${t.title}\n\n${t.body}`, ANTHROPIC_KEY.value() || undefined);
    const order = ["low", "normal", "high", "urgent"] as const;
    const priority = order.indexOf(t.priority) > order.indexOf(result.priority) ? t.priority : result.priority;

    await snap.ref.update({
      category: result.category,
      priority,
      classifiedBy: result.source,
      slaDueAt: Timestamp.fromDate(slaDueDate(t.createdAt.toDate(), priority)),
      slaBreached: false,
    });
    logger.info("ticket classified", { id: snap.id, ...result, priority });
  },
);

/** WhatsApp Cloud API webhook: GET = verification handshake, POST = events. */
export const whatsappWebhook = onRequest(
  { region: REGION, secrets: [WA_APP_SECRET] },
  async (req, res) => {
    if (req.method === "GET") {
      const ok = req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === WA_VERIFY_TOKEN.value();
      res.status(ok ? 200 : 403).send(ok ? String(req.query["hub.challenge"]) : "forbidden");
      return;
    }

    if (!verifySignature(req.rawBody, req.header("x-hub-signature-256"), WA_APP_SECRET.value())) {
      res.status(401).send("bad signature");
      return;
    }

    // answer fast, Meta retries if we take too long
    const messages = extractTextMessages(req.body);
    await Promise.all(messages.map(handleInbound));
    res.sendStatus(200);
  },
);

async function handleInbound(m: ReturnType<typeof extractTextMessages>[number]) {
  // Meta can deliver the same message twice - the message id is the dedupe key
  const dedupe = db.collection("waInbound").doc(m.waMessageId);
  try {
    await dedupe.create({ at: FieldValue.serverTimestamp() });
  } catch {
    logger.info("duplicate whatsapp message skipped", { id: m.waMessageId });
    return;
  }

  const open = await db
    .collection("tickets")
    .where("contactPhone", "==", m.from)
    .where("status", "in", ["new", "open", "waiting"])
    .limit(1)
    .get();

  const now = Timestamp.fromMillis(m.timestamp);
  const message: Message = {
    body: m.text,
    direction: "inbound",
    authorName: m.name,
    waMessageId: m.waMessageId,
    createdAt: now,
  };

  if (!open.empty) {
    const ref = open.docs[0].ref;
    await ref.collection("messages").add(message);
    // customer replied -> back to the agent's queue
    await ref.update({ status: "open", lastMessageAt: now, updatedAt: FieldValue.serverTimestamp() });
    return;
  }

  const ticket: Ticket = {
    title: m.text.split("\n")[0].slice(0, 80) || "WhatsApp message",
    body: m.text,
    status: "new",
    priority: "normal",
    channel: "whatsapp",
    requesterName: m.name,
    contactPhone: m.from,
    assigneeId: null,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };
  const ref = await db.collection("tickets").add(ticket);
  await ref.collection("messages").add(message);
}

/** Agent replies to a WhatsApp ticket from the UI. */
export const replyToTicket = onCall(
  { region: REGION, secrets: [WA_TOKEN] },
  async (req) => {
    const role = req.auth?.token.role;
    if (!req.auth || !["agent", "lead"].includes(role)) throw new HttpsError("permission-denied", "staff only");

    const { ticketId, body } = req.data as { ticketId?: string; body?: string };
    if (!ticketId || !body?.trim()) throw new HttpsError("invalid-argument", "ticketId and body are required");

    const ref = db.collection("tickets").doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "ticket not found");
    const t = snap.data() as Ticket;

    let waMessageId: string | undefined;
    if (t.channel === "whatsapp" && t.contactPhone) {
      waMessageId = await sendText(WA_PHONE_ID.value(), WA_TOKEN.value(), t.contactPhone, body.trim());
    }

    const message: Message = {
      body: body.trim(),
      direction: "outbound",
      authorId: req.auth.uid,
      authorName: req.auth.token.name ?? "Agent",
      createdAt: Timestamp.now(),
      ...(waMessageId ? { waMessageId } : {}),
    };
    await ref.collection("messages").add(message);
    await ref.update({
      status: "waiting",
      assigneeId: t.assigneeId ?? req.auth.uid,
      firstResponseAt: (snap.get("firstResponseAt") as Timestamp | undefined) ?? Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  },
);

/** Marks tickets that passed their SLA without a first response. */
export const checkSla = onSchedule({ schedule: "every 5 minutes", region: REGION }, async () => {
  const overdue = await db
    .collection("tickets")
    .where("status", "in", ["new", "open"])
    .where("slaDueAt", "<=", Timestamp.now())
    .get();

  const batch = db.batch();
  let count = 0;
  for (const doc of overdue.docs) {
    if (doc.get("slaBreached") || doc.get("firstResponseAt")) continue;
    batch.update(doc.ref, { slaBreached: true });
    count++;
  }
  if (count) await batch.commit();
  logger.info("sla check", { breached: count });
});

/** Leads assign roles. Roles live in custom claims so rules can check them cheaply. */
export const setRole = onCall({ region: REGION }, async (req) => {
  if (req.auth?.token.role !== "lead") throw new HttpsError("permission-denied", "leads only");
  const { uid, role } = req.data as { uid: string; role: "requester" | "agent" | "lead" };
  if (!["requester", "agent", "lead"].includes(role)) throw new HttpsError("invalid-argument", "unknown role");

  await getAuth().setCustomUserClaims(uid, { role });
  await db.collection("users").doc(uid).set({ role }, { merge: true });
  return { ok: true };
});

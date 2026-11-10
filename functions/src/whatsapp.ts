import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Meta signs the raw body with the app secret: X-Hub-Signature-256: sha256=<hex> */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface InboundText {
  waMessageId: string;
  from: string; // E.164 without "+"
  name: string;
  text: string;
  timestamp: number;
}

// Webhook payloads are deeply nested and also carry status updates
// (sent/delivered/read) that we don't care about here.
export function extractTextMessages(payload: any): InboundText[] {
  const out: InboundText[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const names = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? c.wa_id]),
      );
      for (const m of value.messages ?? []) {
        if (m.type !== "text") continue;
        out.push({
          waMessageId: m.id,
          from: m.from,
          name: names.get(m.from) ?? m.from,
          text: m.text?.body ?? "",
          timestamp: Number(m.timestamp) * 1000,
        });
      }
    }
  }
  return out;
}

export async function sendText(phoneNumberId: string, token: string, to: string, body: string) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  if (!res.ok) throw new Error(`whatsapp send failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return data.messages?.[0]?.id;
}

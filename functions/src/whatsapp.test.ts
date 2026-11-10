import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractTextMessages, verifySignature } from "./whatsapp";

describe("verifySignature", () => {
  const body = Buffer.from('{"hello":"world"}');
  const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifySignature(body, sig, "secret")).toBe(true);
  });
  it("rejects wrong secret and missing header", () => {
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, undefined, "secret")).toBe(false);
  });
});

describe("extractTextMessages", () => {
  it("skips status updates and non-text messages", () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: "995555000111", profile: { name: "Nino" } }],
            messages: [
              { id: "wamid.1", from: "995555000111", type: "text", timestamp: "1762500000", text: { body: "hi" } },
              { id: "wamid.2", from: "995555000111", type: "image", timestamp: "1762500001" },
            ],
            statuses: [{ id: "wamid.0", status: "read" }],
          },
        }],
      }],
    };
    const msgs = extractTextMessages(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ name: "Nino", text: "hi", timestamp: 1762500000000 });
  });
});

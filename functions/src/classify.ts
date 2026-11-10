import type { Priority } from "./types";

export const CATEGORIES = ["billing", "access", "bug", "data", "hardware", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Classification {
  category: Category;
  priority: Priority;
  source: "ai" | "rules";
}

// Cheap first pass. Also the fallback when the API key is missing or the call fails,
// so a ticket never sits unclassified.
const RULES: Array<[RegExp, Category]> = [
  [/invoice|payment|refund|charge|billing|ინვოის|გადახდ/i, "billing"],
  [/password|login|access|permission|locked|პაროლ|წვდომ/i, "access"],
  [/error|crash|broken|bug|not working|500|შეცდომ|არ მუშაობს/i, "bug"],
  [/report|export|csv|dashboard|numbers|data|რეპორტ/i, "data"],
  [/laptop|printer|monitor|keyboard|scanner|პრინტერ/i, "hardware"],
];

const URGENT = /urgent|asap|down|outage|everyone|სასწრაფო|ვერავინ/i;

export function classifyByRules(text: string): Classification {
  const hit = RULES.find(([re]) => re.test(text));
  const category = hit ? hit[1] : "other";
  let priority: Priority = "normal";
  if (URGENT.test(text)) priority = "urgent";
  else if (category === "billing" || category === "access") priority = "high";
  return { category, priority, source: "rules" };
}

const PROMPT = `You triage internal operations support tickets.
Return JSON only: {"category": one of ${CATEGORIES.join("|")}, "priority": one of low|normal|high|urgent}.
urgent = many people blocked or money at risk right now. low = questions and nice-to-haves.`;

export async function classify(text: string, apiKey?: string): Promise<Classification> {
  if (!apiKey) return classifyByRules(text);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 60,
        system: PROMPT,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);

    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "";
    return parseModelAnswer(raw) ?? classifyByRules(text);
  } catch (err) {
    console.warn("classify fallback to rules:", (err as Error).message);
    return classifyByRules(text);
  }
}

export function parseModelAnswer(raw: string): Classification | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const okCat = (CATEGORIES as readonly string[]).includes(obj.category);
    const okPrio = ["low", "normal", "high", "urgent"].includes(obj.priority);
    if (!okCat || !okPrio) return null;
    return { category: obj.category, priority: obj.priority, source: "ai" };
  } catch {
    return null;
  }
}

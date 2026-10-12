import type { Category } from "./civic";
import { CATEGORY_VALUES } from "./civic";

export type Analysis = {
  category: Category;
  summary: string;
  authority: string;
  source: "ai" | "rule-based";
};

const KEYWORDS: Record<Category, string[]> = {
  pothole: ["pothole", "road", "crack", "asphalt", "speed breaker", "footpath", "pavement"],
  garbage: ["garbage", "trash", "waste", "litter", "dump", "rubbish", "bin", "smell"],
  streetlight: ["streetlight", "street light", "lamp", "light pole", "dark", "bulb"],
  water: ["water", "leak", "pipe", "drain", "drainage", "sewage", "flood", "overflow", "manhole"],
  public_safety: ["unsafe", "theft", "harass", "accident", "fight", "danger", "crime", "fire", "wire"],
  other: [],
};

function isRural(locality: string) {
  return /village|panchayat|gram|rural/i.test(locality);
}

export function authorityFor(category: Category, locality: string) {
  const rural = isRural(locality);
  switch (category) {
    case "pothole":
      return rural ? "Gram Panchayat" : "Road Maintenance Authority";
    case "garbage":
      return rural ? "Gram Panchayat" : "Municipal Corporation – Solid Waste Management";
    case "streetlight":
      return "Electricity Distribution Company";
    case "water":
      return "Water Supply & Sewerage Board";
    case "public_safety":
      return "Local Police Station";
    default:
      return rural ? "Gram Panchayat" : "Municipal Corporation – General Grievances";
  }
}

export function ruleBased(title: string, description: string, locality: string): Analysis {
  const text = `${title} ${description}`.toLowerCase();
  let best: Category = "other";
  let score = 0;
  for (const c of CATEGORY_VALUES) {
    const s = KEYWORDS[c].filter((k) => text.includes(k)).length;
    if (s > score) {
      score = s;
      best = c;
    }
  }
  const first = description.split(/(?<=[.!?])\s/)[0]?.trim() ?? description;
  const summary = (first.length > 160 ? first.slice(0, 157) + "…" : first) || title;
  return { category: best, summary, authority: authorityFor(best, locality), source: "rule-based" };
}

async function callModel(prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI key missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "error" || ev.type === "response.failed") throw new Error("AI stream error");
      } catch (e) {
        if (e instanceof Error && e.message === "AI stream error") throw e;
      }
    }
  }
  return out;
}

export async function analyze(title: string, description: string, locality: string): Promise<Analysis> {
  const fallback = ruleBased(title, description, locality);
  try {
    const prompt = `You classify civic complaints. Use ONLY facts in the complaint; do not invent details.
Categories: ${CATEGORY_VALUES.join(", ")}.
Return ONLY JSON: {"category": one of the categories, "summary": "one neutral sentence under 30 words"}.

Title: ${title}
Locality: ${locality}
Description: ${description}`;
    const text = await callModel(prompt);
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback;
    const parsed = JSON.parse(m[0]) as { category?: string; summary?: string };
    const category = (CATEGORY_VALUES as string[]).includes(parsed.category ?? "")
      ? (parsed.category as Category)
      : fallback.category;
    const summary = (parsed.summary ?? "").trim().slice(0, 300) || fallback.summary;
    return { category, summary, authority: authorityFor(category, locality), source: "ai" };
  } catch (e) {
    console.error("AI analysis failed, using rule-based fallback", e);
    return fallback;
  }
}

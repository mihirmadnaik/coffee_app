// Supabase Edge Function: scan-bean
// Reads a photo of a coffee bag with Claude vision and returns structured
// bean fields for pre-filling the Add Bean form.
//
// Secrets required (never exposed to the browser):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Deploy:
//   supabase functions deploy scan-bean
//
// Auth: requires a signed-in user. The gateway verifies the JWT (default),
// and we additionally resolve the user in-function.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Structured-output schema — the API guarantees the response matches this,
// so no fence-stripping or repair parsing is needed client-side.
const BEAN_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The coffee's name as printed on the bag (not the roaster)",
    },
    roaster: { type: "string", description: "The roasting company's name" },
    origin: {
      type: "string",
      description: "Country/region of origin if printed, else empty",
    },
    process: {
      type: "string",
      description:
        "Processing method as printed (e.g. Washed, Natural, Honey), else empty",
    },
    roastLevel: {
      type: "integer",
      description:
        "1-10 scale: 1-3 light, 4-7 medium, 8-10 dark. Infer from words like 'light roast' or 'French roast'. 0 if unknown.",
    },
    tastingNotes: {
      type: "array",
      items: { type: "string" },
      description: "Short tasting notes printed on the bag",
    },
  },
  required: [
    "name",
    "roaster",
    "origin",
    "process",
    "roastLevel",
    "tastingNotes",
  ],
  additionalProperties: false,
};

// Fallbacks when the app doesn't pass its (community-reviewed) vocabulary.
const DEFAULT_PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic"];
const DEFAULT_NOTES = [
  "Fruity", "Floral", "Nutty", "Chocolatey", "Bright", "Smoky", "Sweet", "Clean",
  "Berry", "Citrus", "Stone Fruit", "Caramel", "Cocoa", "Honey", "Black Tea",
];

// Constrain the model to the known vocabulary so it classifies rather than
// coins near-duplicates — this is what keeps the community review cheap.
function buildPrompt(processes: string[], notes: string[]): string {
  return (
    "This is a photo of a coffee bean bag. Extract the label information into the " +
    "requested fields. Use an empty string, 0, or [] for anything not visible or not " +
    "legible — do not guess values that aren't on the bag.\n\n" +
    "For `process`, classify into exactly one of: " + processes.join(", ") + ". Use an " +
    "empty string if the bag doesn't clearly state a process. Do not invent new process names.\n\n" +
    "For `tastingNotes`, prefer these existing terms whenever they match what's printed: " +
    notes.join(", ") + ". Only use a new short term if none of these fit what the bag says. " +
    "Return an empty array if no tasting notes are printed."
  );
}

// Accept only arrays of short, plain strings; cap count to keep the prompt bounded.
function cleanVocab(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((x) => typeof x === "string" && x.trim() && x.length <= 40)
    .map((x) => (x as string).trim()).slice(0, 200);
  return out.length ? out : fallback;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    // Require a signed-in user (defense in depth on top of gateway JWT check)
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "sign in required" }, 401);

    const { image, knownProcesses, knownNotes } = await req.json();
    if (
      typeof image !== "string" ||
      !image.startsWith("data:image/") ||
      image.length > 2_000_000
    ) {
      return json({ error: "bad image" }, 400);
    }
    const mediaType = image.slice(5, image.indexOf(";"));
    const b64 = image.slice(image.indexOf(",") + 1);
    const prompt = buildPrompt(
      cleanVocab(knownProcesses, DEFAULT_PROCESSES),
      cleanVocab(knownNotes, DEFAULT_NOTES),
    );

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        output_config: {
          format: { type: "json_schema", schema: BEAN_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      console.error("anthropic error", resp.status, await resp.text());
      return json({ error: "vision request failed" }, 502);
    }
    const out = await resp.json();
    if (out.stop_reason === "refusal") {
      return json({ error: "scan declined" }, 422);
    }
    const text: string =
      out.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    return json(JSON.parse(text), 200);
  } catch (e) {
    console.error("[scan-bean]", e);
    return json({ error: "scan failed" }, 500);
  }
});

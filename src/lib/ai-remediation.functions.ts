import { createServerFn } from "@tanstack/react-start";
import { createNvidiaChatCompletion, NVIDIA_DEFAULT_MODEL } from "./friday/nvidia";

export const AI_CATEGORIES = {
  sqli: "SQL injection",
  cmdi: "Command injection",
  access: "Broken access control (IDOR)",
} as const;

export const AI_FRAMEWORKS = [
  "Flask",
  "Django",
  "FastAPI",
  "SQLAlchemy",
  "React",
  "Express",
  "Node.js",
  "Next.js",
  "TypeScript",
  "Plain Python",
  "Other",
] as const;

type Input = {
  category: keyof typeof AI_CATEGORIES;
  framework: (typeof AI_FRAMEWORKS)[number];
  note?: string;
};

export interface AiRemediationResult {
  text?: string;
  reasoning?: string;
  model?: string;
  error?: string;
}

// Only the vulnerability type, framework and an optional short developer note are accepted.
// Scanned source code is never part of this request to maintain privacy.
export const generateRemediation = createServerFn({ method: "POST" })
  .validator((d: Input): Input => {
    if (!d || !(d.category in AI_CATEGORIES)) throw new Error("Unknown vulnerability type");
    if (!AI_FRAMEWORKS.includes(d.framework)) throw new Error("Unknown framework");
    const note = typeof d.note === "string" ? d.note.trim().slice(0, 300) : undefined;
    return { category: d.category, framework: d.framework, note: note || undefined };
  })
  .handler(async ({ data }): Promise<AiRemediationResult> => {
    const apiKey =
      process.env.NVIDIA_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY;

    if (!apiKey) {
      return {
        error:
          "NVIDIA_API_KEY is not configured. Please set your NVIDIA_API_KEY in .env to enable Nemotron AI remediation.",
      };
    }

    try {
      const completion = await createNvidiaChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are an expert principal application security engineer. Provide clear, concise, framework-specific remediation guidance directly: start immediately with root cause, numbered fix steps, code fix before/after, and verify checklist. Avoid raw markdown fences or unnecessary formatting markers. No preamble.",
          },
          {
            role: "user",
            content: `Vulnerability type: ${AI_CATEGORIES[data.category]}\nTarget Framework: ${data.framework}${data.note ? `\nDeveloper context: ${data.note}` : ""}`,
          },
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 4096,
        seed: 42,
        enableThinking: false,
      });

      if (!completion.text) {
        return { error: "The NVIDIA model returned no guidance. Please try again." };
      }

      return {
        text: completion.text,
        reasoning: completion.reasoning,
        model: completion.model || NVIDIA_DEFAULT_MODEL,
      };
    } catch (e: any) {
      console.error("NVIDIA AI remediation request failed:", e);
      const status = e.status || e.statusCode;
      if (status === 429) return { error: "NVIDIA API rate limit reached — please wait a moment and try again." };
      if (status === 401) return { error: "Invalid NVIDIA_API_KEY. Please verify your API key in .env." };
      if (status === 403) return { error: "NVIDIA API access forbidden for this key." };
      return { error: `NVIDIA AI error: ${e.message || "Failed to generate remediation guidance"}` };
    }
  });

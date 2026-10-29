import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b";

export function getNvidiaClient(customApiKey?: string): OpenAI {
  const apiKey =
    customApiKey ||
    process.env.NVIDIA_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not configured. Please set NVIDIA_API_KEY in your .env file or environment."
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL || NVIDIA_BASE_URL,
  });
}

export interface NvidiaCompletionOptions {
  model?: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  enableThinking?: boolean;
  seed?: number;
}

export interface NvidiaCompletionResult {
  text: string;
  reasoning?: string;
  model: string;
}

/**
 * Executes a streaming chat completion against NVIDIA's Integrate API,
 * capturing both reasoning_content (Nemotron thinking tokens) and final text output.
 */
export async function createNvidiaChatCompletion(
  options: NvidiaCompletionOptions,
  customApiKey?: string
): Promise<NvidiaCompletionResult> {
  const openai = getNvidiaClient(customApiKey);
  const model = options.model || process.env.NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL;

  const completion = await openai.chat.completions.create({
    model,
    messages: options.messages as any,
    temperature: options.temperature ?? 1,
    top_p: options.top_p ?? 0.95,
    max_tokens: options.max_tokens ?? 16384,
    parallel_tool_calls: true,
    seed: options.seed ?? 42,
    chat_template_kwargs: options.enableThinking ? { enable_thinking: true } : undefined,
    stream: true,
  } as any);

  let fullContent = "";
  let fullReasoning = "";

  for await (const chunk of completion as any) {
    const delta = chunk.choices?.[0]?.delta;
    const reasoning = delta?.reasoning_content;
    if (reasoning) {
      fullReasoning += reasoning;
    }
    const content = delta?.content;
    if (content) {
      fullContent += content;
    }
  }

  return {
    text: fullContent.trim(),
    reasoning: fullReasoning.trim() || undefined,
    model,
  };
}


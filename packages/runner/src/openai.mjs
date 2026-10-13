const API = "https://api.openai.com/v1";

function headers() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return {
    Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    "Content-Type": "application/json"
  };
}

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { ...headers(), ...(options.headers ?? {}) }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error("OpenAI " + response.status + ": " + JSON.stringify(data).slice(0, 1000));
    error.status = response.status;
    throw error;
  }
  return data;
}

function runnerInstructions() {
  return [
    "You are an external continuity runner for a user-managed project.",
    "You are not ChatGPT, Codex, a PJM, a Master, or a first-class Worker.",
    "Do not depend on ChatGPT chat history, ChatGPT plugins, Codex-only tools, or a user keeping a chat open.",
    "Obey the supplied target write mode. read_only means never claim to have changed the target repository.",
    "Prefer concrete new findings over repeated summaries.",
    "Distinguish observed repository facts, inference, and proposals.",
    "If nothing material changed, say so briefly and do not manufacture work.",
    "End with headings: Findings, Risks, Next focus, Status.",
    "Status must be one of CONTINUE, BLOCKED, COMPLETE."
  ].join("\n");
}

export function hasOpenAiCredential() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isCredentialError(error) {
  return Number(error?.status) === 401 || /OPENAI_API_KEY|authentication|api key/i.test(String(error?.message ?? ""));
}

export async function createResponse(config, input, previousResponseId = null) {
  return request("/responses", {
    method: "POST",
    body: JSON.stringify({
      model: config.model.id,
      reasoning: { effort: config.model.reasoning_effort },
      instructions: runnerInstructions(),
      input,
      store: true,
      tools: config.model.web_search ? [{ type: "web_search" }] : [],
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {})
    })
  });
}

export function responseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const pieces = [];
  for (const item of response?.output ?? []) {
    if (item.type !== "message" || item.role !== "assistant") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") pieces.push(part.text);
      else if (typeof part.text === "string") pieces.push(part.text);
    }
  }
  return pieces.join("\n").trim() || null;
}

export function parseRunnerStatus(text) {
  const matches = [...String(text).matchAll(/^Status:\s*(CONTINUE|BLOCKED|COMPLETE)\s*$/gim)];
  return matches.length ? matches[matches.length - 1][1].toUpperCase() : null;
}

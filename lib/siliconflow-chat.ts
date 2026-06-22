import pRetry, { AbortError } from "p-retry";
import { getEncoding } from "js-tiktoken";

export type SiliconFlowChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostCny: number;
  outputCostCny: number;
  totalCostCny: number;
};

export type StreamChatResult = {
  assistantContent: string;
  usage: ChatUsage;
};

type RetryableHttpError = Error & {
  status: number;
  retryAfterMs: number | null;
};

type SiliconFlowStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const SILICONFLOW_MODEL = "deepseek-ai/DeepSeek-V3.2-Exp";
const REQUEST_TIMEOUT_MS = 120_000;
const INPUT_PRICE_PER_MILLION = 2;
const OUTPUT_PRICE_PER_MILLION = 3;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_TIMES = 4;

const createRetryableHttpError = (
  status: number,
  body: string,
  retryAfterMs: number | null
): RetryableHttpError => {
  const message = `SiliconFlow API request failed (${status}): ${body || "Unknown error"}`;
  const error = new Error(message) as RetryableHttpError;
  error.status = status;
  error.retryAfterMs = retryAfterMs;
  return error;
};

const parseRetryAfterMs = (retryAfterHeader: string | null): number | null => {
  if (!retryAfterHeader) {
    return null;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1_000);
  }

  const asDate = Date.parse(retryAfterHeader);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, asDate - Date.now());
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const formatCny = (value: number): number => Number(value.toFixed(8));

const encodeTokenLength = (text: string): number => {
  const encoding = getEncoding("o200k_base");
  try {
    return encoding.encode(text).length;
  } finally {
    encoding.free();
  }
};

const countInputTokens = (messages: SiliconFlowChatMessage[]): number => {
  const serialised = messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  return encodeTokenLength(serialised);
};

const createAttemptSignal = (outerSignal?: AbortSignal) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`SiliconFlow request timed out after ${REQUEST_TIMEOUT_MS}ms.`));
  }, REQUEST_TIMEOUT_MS);

  const abortFromOuter = () => {
    controller.abort(outerSignal?.reason);
  };

  if (outerSignal) {
    if (outerSignal.aborted) {
      abortFromOuter();
    } else {
      outerSignal.addEventListener("abort", abortFromOuter, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    outerSignal?.removeEventListener("abort", abortFromOuter);
  };

  return {
    signal: controller.signal,
    cleanup
  };
};

const isRetryableStatus = (status: number): boolean => {
  return status === 429 || status === 408 || status >= 500;
};

const requestSiliconFlowStream = async (
  messages: SiliconFlowChatMessage[],
  signal?: AbortSignal
): Promise<Response> => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: SILICONFLOW_API_KEY");
  }

  return pRetry(
    async () => {
      const { signal: attemptSignal, cleanup } = createAttemptSignal(signal);
      try {
        const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: SILICONFLOW_MODEL,
            messages,
            stream: true,
            temperature: 0.8,
            max_tokens: 65535
            // seed: 1234
          }),
          signal: attemptSignal
        });

        if (!response.ok) {
          const bodyText = await response.text();
          const retryAfterMs =
            response.status === 429 ? parseRetryAfterMs(response.headers.get("Retry-After")) : null;

          if (isRetryableStatus(response.status)) {
            throw createRetryableHttpError(response.status, bodyText, retryAfterMs);
          }

          throw new AbortError(
            `SiliconFlow API request failed (${response.status}): ${bodyText || "Unknown error"}`
          );
        }

        if (!response.body) {
          throw createRetryableHttpError(response.status, "Empty stream body.", null);
        }

        return response;
      } finally {
        cleanup();
      }
    },
    {
      retries: MAX_RETRY_TIMES,
      minTimeout: 1_000,
      factor: 2,
      maxTimeout: 20_000,
      randomize: false,
      onFailedAttempt: async ({ error }) => {
        const typedError = error as Partial<RetryableHttpError>;
        const retryAfterMs = typedError.retryAfterMs;
        if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
          await sleep(retryAfterMs);
          return;
        }

        if (typedError.status === 429) {
          await sleep(DEFAULT_RETRY_DELAY_MS);
        }
      },
      shouldRetry: ({ error }) => {
        const typedError = error as Partial<RetryableHttpError>;
        return Boolean(
          typedError.status === 429 ||
            typedError.status === 408 ||
            (typeof typedError.status === "number" && typedError.status >= 500)
        );
      }
    }
  );
};

const extractSseEvents = (buffer: string): { events: string[]; rest: string } => {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events: string[] = [];
  let cursor = 0;

  while (true) {
    const eventBoundary = normalized.indexOf("\n\n", cursor);
    if (eventBoundary === -1) {
      return { events, rest: normalized.slice(cursor) };
    }

    events.push(normalized.slice(cursor, eventBoundary));
    cursor = eventBoundary + 2;
  }
};

const parseDeltaFromEvent = (eventBlock: string): { delta: string; done: boolean } => {
  const dataLines = eventBlock
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return { delta: "", done: false };
  }

  const payload = dataLines.join("\n");
  if (payload === "[DONE]") {
    return { delta: "", done: true };
  }

  let parsed: SiliconFlowStreamChunk | null = null;
  try {
    parsed = JSON.parse(payload) as SiliconFlowStreamChunk;
  } catch {
    return { delta: "", done: false };
  }

  const delta = parsed.choices?.[0]?.delta?.content;
  return {
    delta: typeof delta === "string" ? delta : "",
    done: false
  };
};

export const streamChatWithSiliconFlow = async (
  messages: SiliconFlowChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<StreamChatResult> => {
  const response = await requestSiliconFlowStream(messages, signal);
  if (!response.body) {
    throw new Error("SiliconFlow API returned an empty stream body.");
  }

  const inputTokens = countInputTokens(messages);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let rest = "";
  let assistantContent = "";
  let reachedDone = false;

  while (!reachedDone) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    rest += decoder.decode(value, { stream: true });
    const extracted = extractSseEvents(rest);
    rest = extracted.rest;

    for (const eventBlock of extracted.events) {
      const parsed = parseDeltaFromEvent(eventBlock);
      if (parsed.delta) {
        assistantContent += parsed.delta;
        onDelta(parsed.delta);
      }

      if (parsed.done) {
        reachedDone = true;
        break;
      }
    }
  }

  const outputTokens = encodeTokenLength(assistantContent);
  const inputCostCny = formatCny((inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION);
  const outputCostCny = formatCny((outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION);
  const totalCostCny = formatCny(inputCostCny + outputCostCny);

  return {
    assistantContent,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCostCny,
      outputCostCny,
      totalCostCny
    }
  };
};

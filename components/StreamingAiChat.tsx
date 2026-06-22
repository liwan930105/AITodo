import { useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostCny: number;
  outputCostCny: number;
  totalCostCny: number;
};

type DonePayload = {
  content: string;
  usage: ChatUsage;
};

const isDonePayload = (value: unknown): value is DonePayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as { content?: unknown; usage?: unknown };
  if (typeof payload.content !== "string") {
    return false;
  }

  if (typeof payload.usage !== "object" || payload.usage === null) {
    return false;
  }

  const usage = payload.usage as Record<string, unknown>;
  return (
    typeof usage.inputTokens === "number" &&
    typeof usage.outputTokens === "number" &&
    typeof usage.totalTokens === "number" &&
    typeof usage.inputCostCny === "number" &&
    typeof usage.outputCostCny === "number" &&
    typeof usage.totalCostCny === "number"
  );
};

const decodeEventBlocks = (buffer: string): { blocks: string[]; rest: string } => {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks: string[] = [];
  let cursor = 0;

  while (true) {
    const boundary = normalized.indexOf("\n\n", cursor);
    if (boundary === -1) {
      return { blocks, rest: normalized.slice(cursor) };
    }

    blocks.push(normalized.slice(cursor, boundary));
    cursor = boundary + 2;
  }
};

const parseEventBlock = (
  block: string
): {
  event: string;
  payload: unknown;
} | null => {
  if (!block.trim()) {
    return null;
  }

  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const dataText = dataLines.join("\n");
  try {
    return { event, payload: JSON.parse(dataText) as unknown };
  } catch {
    return null;
  }
};

const mergeChunkWithoutRepeat = (current: string, incoming: string): string => {
  if (!incoming) {
    return current;
  }
  if (!current) {
    return incoming;
  }
  if (incoming.startsWith(current)) {
    return incoming;
  }
  if (current.endsWith(incoming)) {
    return current;
  }

  const maxOverlap = Math.min(current.length, incoming.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === incoming.slice(0, overlap)) {
      return current + incoming.slice(overlap);
    }
  }

  return current + incoming;
};

const consumeSse = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, payload: unknown) => void
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let rest = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    rest += decoder.decode(value, { stream: true });
    const parsed = decodeEventBlocks(rest);
    rest = parsed.rest;

    for (const block of parsed.blocks) {
      const eventData = parseEventBlock(block);
      if (eventData) {
        onEvent(eventData.event, eventData.payload);
      }
    }
  }
};

const formatMoney = (value: number): string => {
  return `${value.toFixed(8)} 元`;
};

export default function StreamingAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [draftAssistant, setDraftAssistant] = useState("");
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftAssistantRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    draftAssistantRef.current = draftAssistant;
  }, [draftAssistant]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || submitting) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: question };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setUsage(null);
    setError(null);
    setDraftAssistant("");
    draftAssistantRef.current = "";
    setSubmitting(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let finalAssistantContent = "";
    let finalUsage: ChatUsage | null = null;

    try {
      const response = await fetch("/api/ai/stream-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: currentMessages
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const text = await response.text();
        let message = "流式请求失败，请稍后重试。";
        try {
          const payload = JSON.parse(text) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          if (text) {
            message = text;
          }
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("服务端未返回流式内容。");
      }

      await consumeSse(response.body, (eventName, payload) => {
        if (eventName === "delta") {
          const chunk =
            typeof payload === "object" && payload !== null && "content" in payload
              ? (payload as { content?: unknown }).content
              : "";
          if (typeof chunk === "string" && chunk.length > 0) {
            setDraftAssistant((previous) => mergeChunkWithoutRepeat(previous, chunk));
          }
          return;
        }

        if (eventName === "done") {
          if (isDonePayload(payload)) {
            finalAssistantContent = payload.content;
            finalUsage = payload.usage;
          }
          return;
        }

        if (eventName === "error") {
          const message =
            typeof payload === "object" && payload !== null && "message" in payload
              ? (payload as { message?: string }).message
              : undefined;
          throw new Error(message || "流式生成失败。");
        }
      });

      const finalText = finalAssistantContent || draftAssistantRef.current;
      if (finalText.trim()) {
        setMessages((current) => [...current, { role: "assistant", content: finalText }]);
      }
      setDraftAssistant("");

      if (finalUsage) {
        setUsage(finalUsage);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("请求已取消。");
      } else {
        setError(err instanceof Error ? err.message : "流式请求失败，请稍后重试。");
      }
    } finally {
      setSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <section aria-label="流式 AI 聊天">
      <header className="mb-6">
        <p className="font-handwriting text-base text-ink-light/70">Stream Chat · 实时打字机</p>
        <h2 className="font-handwriting mt-1 text-3xl text-ink">流式AI</h2>
        <p className="font-handwriting mt-2 text-lg text-ink-light">
          支持 SSE 流式输出，响应会逐字显示，自动去重并统计 token 与成本。
        </p>
      </header>

      <article className="journal-output mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-handwriting text-xl text-ink">对话记录</h3>
          {submitting ? <span className="font-handwriting text-ink-light">AI 正在输入…</span> : null}
        </div>

        {messages.length === 0 && !draftAssistant ? (
          <p className="font-handwriting text-lg text-ink-light">先输入一句话，开始聊天吧。</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {messages.map((message, index) => (
              <li
                key={`${message.role}-${index}`}
                className={[
                  "max-w-[90%] whitespace-pre-wrap rounded-md border px-3 py-2 text-sm leading-7",
                  message.role === "user"
                    ? "self-end border-amber-700/40 bg-amber-50 text-amber-900"
                    : "self-start border-stone-400/40 bg-stone-50 text-stone-800"
                ].join(" ")}
              >
                {message.content}
              </li>
            ))}

            {draftAssistant ? (
              <li className="max-w-[90%] self-start whitespace-pre-wrap rounded-md border border-stone-400/40 bg-stone-50 px-3 py-2 text-sm leading-7 text-stone-800">
                {draftAssistant}
              </li>
            ) : null}
          </ul>
        )}
      </article>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="stream-ai-input" className="journal-label">
            发送消息
          </label>
          <textarea
            id="stream-ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            disabled={submitting}
            className="journal-textarea"
            placeholder="例如：帮我写一个 7 天健身计划，并解释每天重点。"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !input.trim()}
          className="journal-btn journal-btn-primary w-full sm:w-auto"
        >
          {submitting ? "正在流式生成…" : "发送"}
        </button>
      </form>

      {usage ? (
        <article className="journal-output mt-6">
          <h3 className="font-handwriting text-xl text-ink">本次请求统计</h3>
          <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 text-sm text-ink-light sm:grid-cols-2">
            <li>输入 Token：{usage.inputTokens}</li>
            <li>输出 Token：{usage.outputTokens}</li>
            <li>总 Token：{usage.totalTokens}</li>
            <li>总成本：{formatMoney(usage.totalCostCny)}</li>
            <li>输入成本：{formatMoney(usage.inputCostCny)}</li>
            <li>输出成本：{formatMoney(usage.outputCostCny)}</li>
          </ul>
        </article>
      ) : null}

      {error ? (
        <div className="journal-error mt-6" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}

import type { NextApiRequest, NextApiResponse } from "next";
import {
  streamChatWithSiliconFlow,
  type ChatUsage,
  type SiliconFlowChatMessage
} from "../../../lib/siliconflow-chat";
import { validateStreamChatInput } from "../../../lib/stream-chat-types";

type ErrorResponse = {
  error: string;
};

type StreamDonePayload = {
  content: string;
  usage: ChatUsage;
};

const SYSTEM_PROMPT =
  "你是一个耐心、清晰、实用的 AI 助手。回答时优先使用中文，给出可执行建议。";

const writeSseEvent = (res: NextApiResponse, event: string, payload: Record<string, unknown>) => {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse>
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const parsedBody = validateStreamChatInput(req.body);
  if (!parsedBody) {
    res.status(400).json({
      error: "Invalid request body. Expected { messages: Array<{ role: 'user' | 'assistant'; content: string }> }."
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const requestAbortController = new AbortController();
  req.on("close", () => {
    requestAbortController.abort();
  });

  const modelMessages: SiliconFlowChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...parsedBody.messages
  ];

  try {
    const result = await streamChatWithSiliconFlow(
      modelMessages,
      (chunk) => {
        writeSseEvent(res, "delta", { content: chunk });
      },
      requestAbortController.signal
    );

    const donePayload: StreamDonePayload = {
      content: result.assistantContent,
      usage: result.usage
    };
    writeSseEvent(res, "done", donePayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while streaming AI chat.";
    writeSseEvent(res, "error", { message });
  } finally {
    res.end();
  }
}

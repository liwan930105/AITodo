import { isPlainObject } from "./task-types";

export const STREAM_CHAT_ROLES = ["user", "assistant"] as const;

export type StreamChatRole = (typeof STREAM_CHAT_ROLES)[number];

export type StreamChatMessage = {
  role: StreamChatRole;
  content: string;
};

export type StreamChatInput = {
  messages: StreamChatMessage[];
};

const isStreamChatRole = (value: unknown): value is StreamChatRole => {
  return typeof value === "string" && STREAM_CHAT_ROLES.includes(value as StreamChatRole);
};

export const validateStreamChatInput = (body: unknown): StreamChatInput | null => {
  if (!isPlainObject(body) || !Array.isArray(body.messages) || body.messages.length === 0) {
    return null;
  }

  const messages: StreamChatMessage[] = [];
  for (const item of body.messages) {
    if (!isPlainObject(item) || !isStreamChatRole(item.role) || typeof item.content !== "string") {
      return null;
    }

    const content = item.content.trim();
    if (!content) {
      return null;
    }

    messages.push({
      role: item.role,
      content
    });
  }

  return { messages };
};

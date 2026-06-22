import { isPlainObject } from "./task-types";

export type OptimizePromptInput = {
  userRequest: string;
  userInput?: string;
};

export const validateOptimizePromptInput = (body: unknown): OptimizePromptInput | null => {
  if (!isPlainObject(body)) {
    return null;
  }

  const userRequest = body.userRequest;
  const userInput = body.userInput;

  if (typeof userRequest !== "string" || userRequest.trim().length === 0) {
    return null;
  }

  if (typeof userInput !== "undefined" && typeof userInput !== "string") {
    return null;
  }

  return {
    userRequest: userRequest.trim(),
    userInput: typeof userInput === "string" ? userInput.trim() : undefined
  };
};

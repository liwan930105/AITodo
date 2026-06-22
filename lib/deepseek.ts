import { buildMetaPrompt } from "./prompt-meta";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-v4-pro";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const extractJsonArray = (content: string): string[] | null => {
  const trimmed = content.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const steps = parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
};

export const breakdownTaskWithDeepSeek = async (taskTitle: string): Promise<string[]> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: DEEPSEEK_API_KEY");
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a task planning assistant. Break down tasks into clear, actionable sub-steps."
        },
        {
          role: "user",
          content: `Break down the following task into 3 to 5 clear, actionable sub-steps. Return ONLY a JSON array of strings. Each string is one sub-step title. Do not include markdown or any other text.\n\nTask: ${taskTitle}`
        }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek API returned an empty response.");
  }

  const steps = extractJsonArray(content);
  if (!steps || steps.length < 3 || steps.length > 5) {
    throw new Error("DeepSeek API did not return 3 to 5 valid sub-steps.");
  }

  return steps;
};

export const optimizePromptWithDeepSeek = async (
  userRequest: string,
  userInput?: string
): Promise<string> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: DEEPSEEK_API_KEY");
  }

  const resolvedInput = userInput && userInput.length > 0 ? userInput : userRequest;
  const metaPrompt = buildMetaPrompt(userRequest, resolvedInput);

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "user",
          content: metaPrompt
        }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("DeepSeek API returned an empty response.");
  }

  return content;
};

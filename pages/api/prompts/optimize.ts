import type { NextApiRequest, NextApiResponse } from "next";
import { optimizePromptWithDeepSeek } from "../../../lib/deepseek";
import { validateOptimizePromptInput } from "../../../lib/prompt-types";

type ErrorResponse = {
  error: string;
};

type OptimizePromptResponse = {
  data: {
    optimizedPrompt: string;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OptimizePromptResponse | ErrorResponse>
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const parsedBody = validateOptimizePromptInput(req.body);
    if (!parsedBody) {
      res.status(400).json({
        error: "Invalid request body. Expected { userRequest: string; userInput?: string }."
      });
      return;
    }

    const optimizedPrompt = await optimizePromptWithDeepSeek(
      parsedBody.userRequest,
      parsedBody.userInput
    );

    res.status(200).json({
      data: {
        optimizedPrompt
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while optimizing prompt.";
    res.status(500).json({ error: message });
  }
}

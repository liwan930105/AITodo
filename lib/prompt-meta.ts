import { readFileSync } from "fs";
import { join } from "path";

const META_PROMPT_PATH = join(process.cwd(), "prompts", "元提示词.md");

export const loadMetaPromptTemplate = (): string => {
  return readFileSync(META_PROMPT_PATH, "utf-8");
};

export const buildMetaPrompt = (userRequest: string, userInput: string): string => {
  const template = loadMetaPromptTemplate();
  return template
    .replace(/\{\{user_request\}\}/g, userRequest)
    .replace(/\{\{user_input\}\}/g, userInput);
};

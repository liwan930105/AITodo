import { useState } from "react";
import { fetchJson } from "../lib/api-client";

type OptimizeResponse = {
  data: {
    optimizedPrompt: string;
  };
};

export default function PromptGenerator() {
  const [userRequest, setUserRequest] = useState("");
  const [userInput, setUserInput] = useState("");
  const [optimizedPrompt, setOptimizedPrompt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedRequest = userRequest.trim();
    if (!trimmedRequest) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setOptimizedPrompt(null);
    setCopied(false);

    try {
      const result = await fetchJson<OptimizeResponse>("/api/prompts/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest: trimmedRequest,
          userInput: userInput.trim() || undefined
        })
      });
      setOptimizedPrompt(result.data.optimizedPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提示词优化失败。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!optimizedPrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(optimizedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败，请手动选择文本复制。");
    }
  };

  return (
    <section aria-label="提示词生成">
      <header className="mb-6">
        <p className="font-handwriting text-base text-ink-light/70">Prompt Studio · 手账工坊</p>
        <h2 className="font-handwriting mt-1 text-3xl text-ink">提示词生成</h2>
        <p className="font-handwriting mt-2 text-lg text-ink-light">
          写下模糊的想法，AI 帮你整理成结构化的高质量 Prompt ✎
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="user-request" className="journal-label">
            你的需求
          </label>
          <textarea
            id="user-request"
            value={userRequest}
            onChange={(event) => setUserRequest(event.target.value)}
            placeholder="例如：帮我写一个 Python 脚本，批量重命名文件夹里的图片…"
            className="journal-textarea"
            rows={4}
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="user-input" className="journal-label">
            补充输入
            <span className="ml-1 text-sm text-ink-light/60">（可选）</span>
          </label>
          <textarea
            id="user-input"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            placeholder="实际要处理的数据、示例文本或具体参数…"
            className="journal-textarea"
            rows={3}
            disabled={submitting}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !userRequest.trim()}
          className="journal-btn journal-btn-primary w-full sm:w-auto"
        >
          {submitting ? "AI 撰写中…" : "✨ 生成优化提示词"}
        </button>
      </form>

      {error ? (
        <div className="journal-error mt-6" role="alert">
          {error}
        </div>
      ) : null}

      {submitting ? (
        <div className="journal-loading mt-8" aria-live="polite">
          <p className="font-handwriting text-xl text-ink-light">正在翻阅元提示词，精心雕琢中…</p>
          <div className="journal-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}

      {optimizedPrompt ? (
        <article className="journal-output mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-handwriting text-xl text-ink">优化后的 Prompt</h3>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="journal-btn px-3 py-1 text-sm"
            >
              {copied ? "已复制 ✓" : "复制"}
            </button>
          </div>
          <pre className="journal-output-content">{optimizedPrompt}</pre>
        </article>
      ) : null}
    </section>
  );
}

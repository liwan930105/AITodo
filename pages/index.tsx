import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import TaskRow from "../components/TaskRow";
import { fetchJson } from "../lib/api-client";
import { buildTaskTree, mergeTasks, removeTaskAndDescendants } from "../lib/task-tree";
import type { TaskRecord, TaskStatus } from "../lib/task-types";

type BreakdownResponse = {
  data: {
    parent: TaskRecord;
    subtasks: TaskRecord[];
    steps: string[];
  };
};

export default function HomePage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);

  const loadTasks = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchJson<{ data: TaskRecord[] }>("/api/tasks");
      setTasks(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<{ data: TaskRecord }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle })
      });
      setTasks((current) => [result.data, ...current]);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建任务失败。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (task: TaskRecord) => {
    const nextStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    setActionId(task.id);
    setError(null);
    try {
      const result = await fetchJson<{ data: TaskRecord }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? result.data : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新状态失败。");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    setActionId(taskId);
    setError(null);
    try {
      await fetchJson<{ data: { id: string } }>(`/api/tasks/${taskId}`, {
        method: "DELETE"
      });
      setTasks((current) => removeTaskAndDescendants(current, taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除任务失败。");
    } finally {
      setActionId(null);
    }
  };

  const handleBreakdown = async (task: TaskRecord) => {
    setActionId(task.id);
    setError(null);
    try {
      const result = await fetchJson<BreakdownResponse>("/api/tasks/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, title: task.title })
      });
      setTasks((current) => mergeTasks(current, result.data.subtasks));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 拆解失败。");
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const completedCount = tasks.length - pendingCount;

  return (
    <>
      <Head>
        <title>我的手账待办</title>
        <meta name="description" content="复古手账风格的 AI 待办事项" />
      </Head>

      <main className="journal-page">
        <div className="journal-notebook">
          <header className="mb-8">
            <p className="font-handwriting text-base text-ink-light/70">AITodo · 手账本</p>
            <h1 className="font-handwriting mt-1 text-4xl text-ink">我的待办清单</h1>
            <p className="font-handwriting mt-2 text-lg text-ink-light">
              待完成 {pendingCount} 项 · 已完成 {completedCount} 项
            </p>
          </header>

          <form onSubmit={handleCreate} className="mb-8 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="task-title" className="sr-only">
                任务标题
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="写下一件要做的事…"
                className="journal-input w-full"
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="journal-btn journal-btn-primary"
            >
              {submitting ? "添加中…" : "添加"}
            </button>
          </form>

          {error ? (
            <div className="journal-error" role="alert">
              {error}
            </div>
          ) : null}

          <section aria-label="任务列表">
            {loading ? (
              <p className="font-handwriting text-xl text-ink-light">翻阅手账中…</p>
            ) : taskTree.length === 0 ? (
              <p className="font-handwriting text-xl text-ink-light">还没有任务，写第一条吧 ✎</p>
            ) : (
              <ul className="m-0 p-0">
                {taskTree.map((node, index) => (
                  <TaskRow
                    key={node.task.id}
                    node={node}
                    depth={0}
                    index={index}
                    actionId={actionId}
                    onToggle={handleToggleStatus}
                    onDelete={handleDelete}
                    onBreakdown={handleBreakdown}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

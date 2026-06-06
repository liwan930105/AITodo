import { useCallback, useEffect, useState } from "react";
import type { TaskRecord, TaskStatus } from "../lib/task-types";

type ApiError = {
  error: string;
};

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as ApiError).error
        : "请求失败，请稍后重试。";
    throw new Error(message);
  }

  return payload as T;
};

const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function HomePage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null
        })
      });
      setTasks((current) => [result.data, ...current]);
      setTitle("");
      setDescription("");
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
      setTasks((current) => current.filter((item) => item.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除任务失败。");
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = tasks.filter((task) => task.status === "pending").length;
  const completedCount = tasks.length - pendingCount;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>AITodo</p>
            <h1 style={styles.title}>我的待办</h1>
            <p style={styles.subtitle}>简洁的任务管理，支持完成、删除与描述备注。</p>
          </div>
          <div style={styles.stats}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{pendingCount}</span>
              <span style={styles.statLabel}>待完成</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{completedCount}</span>
              <span style={styles.statLabel}>已完成</span>
            </div>
          </div>
        </header>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>新建任务</h2>
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="任务标题"
              style={styles.input}
              disabled={submitting}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="描述（可选）"
              rows={3}
              style={styles.textarea}
              disabled={submitting}
            />
            <button type="submit" style={styles.primaryButton} disabled={submitting || !title.trim()}>
              {submitting ? "创建中..." : "添加任务"}
            </button>
          </form>
        </section>

        {error ? (
          <div style={styles.errorBanner} role="alert">
            {error}
          </div>
        ) : null}

        <section style={styles.card}>
          <div style={styles.listHeader}>
            <h2 style={styles.cardTitle}>任务列表</h2>
            <button type="button" onClick={() => void loadTasks()} style={styles.ghostButton}>
              刷新
            </button>
          </div>

          {loading ? (
            <p style={styles.emptyText}>加载中...</p>
          ) : tasks.length === 0 ? (
            <p style={styles.emptyText}>还没有任务，先添加一条吧。</p>
          ) : (
            <ul style={styles.list}>
              {tasks.map((task) => {
                const isBusy = actionId === task.id;
                const isCompleted = task.status === "completed";

                return (
                  <li
                    key={task.id}
                    style={{
                      ...styles.taskItem,
                      ...(isCompleted ? styles.taskItemCompleted : {})
                    }}
                  >
                    <div style={styles.taskMain}>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(task)}
                        disabled={isBusy}
                        style={{
                          ...styles.checkbox,
                          ...(isCompleted ? styles.checkboxChecked : {})
                        }}
                        aria-label={isCompleted ? "标记为未完成" : "标记为已完成"}
                      >
                        {isCompleted ? "✓" : ""}
                      </button>
                      <div style={styles.taskContent}>
                        <p style={{ ...styles.taskTitle, ...(isCompleted ? styles.taskTitleDone : {}) }}>
                          {task.title}
                        </p>
                        {task.description ? (
                          <p style={styles.taskDescription}>{task.description}</p>
                        ) : null}
                        <p style={styles.taskMeta}>{formatDate(task.created_at)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task.id)}
                      disabled={isBusy}
                      style={styles.deleteButton}
                    >
                      删除
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 16px 48px"
  },
  container: {
    maxWidth: "720px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap"
  },
  eyebrow: {
    margin: "0 0 8px",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#6366f1"
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.2
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "15px"
  },
  stats: {
    display: "flex",
    gap: "12px"
  },
  statCard: {
    minWidth: "88px",
    padding: "12px 16px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#0f172a"
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b"
  },
  card: {
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "16px"
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    outline: "none"
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    resize: "vertical",
    outline: "none"
  },
  primaryButton: {
    alignSelf: "flex-start",
    padding: "10px 18px",
    borderRadius: "12px",
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600
  },
  ghostButton: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155"
  },
  errorBanner: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: "14px"
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px"
  },
  emptyText: {
    margin: "16px 0 0",
    color: "#64748b"
  },
  list: {
    listStyle: "none",
    margin: "16px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  taskItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc"
  },
  taskItemCompleted: {
    background: "#f1f5f9",
    opacity: 0.85
  },
  taskMain: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    flex: 1,
    minWidth: 0
  },
  checkbox: {
    width: "24px",
    height: "24px",
    borderRadius: "8px",
    border: "2px solid #94a3b8",
    background: "#fff",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "14px",
    fontWeight: 700
  },
  checkboxChecked: {
    background: "#22c55e",
    borderColor: "#22c55e"
  },
  taskContent: {
    minWidth: 0
  },
  taskTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    wordBreak: "break-word"
  },
  taskTitleDone: {
    textDecoration: "line-through",
    color: "#64748b"
  },
  taskDescription: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: "14px",
    wordBreak: "break-word"
  },
  taskMeta: {
    margin: "8px 0 0",
    fontSize: "12px",
    color: "#94a3b8"
  },
  deleteButton: {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#dc2626",
    flexShrink: 0
  }
};

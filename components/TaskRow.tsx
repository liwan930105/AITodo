import HandCheckbox from "./HandCheckbox";
import type { TaskNode } from "../lib/task-tree";
import type { TaskRecord } from "../lib/task-types";

type TaskRowProps = {
  node: TaskNode;
  depth: number;
  index: number;
  actionId: string | null;
  onToggle: (task: TaskRecord) => void;
  onDelete: (taskId: string) => void;
  onBreakdown: (task: TaskRecord) => void;
};

function CompletedDecoration({ variant }: { variant: "tape" | "pin" }) {
  if (variant === "tape") {
    return (
      <div
        className="pointer-events-none absolute -top-2 right-6 h-5 w-14 rotate-6 opacity-80"
        aria-hidden="true"
      >
        <div className="h-full w-full rounded-sm bg-amber-200/70 shadow-sm ring-1 ring-amber-300/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2"
      aria-hidden="true"
    >
      <div className="h-3.5 w-3.5 rounded-full bg-red-600 shadow-md ring-2 ring-red-800/30" />
      <div className="mx-auto -mt-0.5 h-2 w-0.5 bg-neutral-400" />
    </div>
  );
}

export default function TaskRow({
  node,
  depth,
  index,
  actionId,
  onToggle,
  onDelete,
  onBreakdown
}: TaskRowProps) {
  const { task, children } = node;
  const isBusy = actionId === task.id;
  const isCompleted = task.status === "completed";
  const decoration = index % 2 === 0 ? "tape" : "pin";

  return (
    <li className="list-none">
      <div
        className="relative"
        style={{ paddingLeft: depth > 0 ? `${depth * 1.75}rem` : undefined }}
      >
        {depth > 0 ? (
          <div
            className="absolute bottom-3 left-3 top-3 w-px bg-amber-800/20"
            aria-hidden="true"
          />
        ) : null}

        <article
          className={[
            "relative mb-3 rounded-sm border border-amber-900/15 bg-[#fffef8]/90 px-3 py-3 shadow-sm",
            "transition-all duration-200",
            isCompleted ? "opacity-75" : "",
            depth > 0 ? "ml-2 border-dashed" : ""
          ].join(" ")}
        >
          {isCompleted ? <CompletedDecoration variant={decoration} /> : null}

          <div className="flex items-start gap-3">
            <HandCheckbox
              checked={isCompleted}
              disabled={isBusy}
              onChange={() => onToggle(task)}
              label={isCompleted ? "标记为未完成" : "标记为已完成"}
            />

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={[
                  "font-handwriting text-xl leading-snug text-ink break-words",
                  isCompleted ? "text-ink-light line-through decoration-amber-800/40 decoration-2" : ""
                ].join(" ")}
              >
                {task.title}
              </p>
              {task.description ? (
                <p className="mt-1 font-handwriting text-sm text-ink-light/80">{task.description}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={isBusy || isCompleted}
                onClick={() => onBreakdown(task)}
                className="journal-btn journal-btn-accent px-2.5 py-1 text-sm"
                title="AI 拆解任务"
              >
                {isBusy ? "…" : "拆解"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDelete(task.id)}
                className="journal-btn journal-btn-danger px-2.5 py-1 text-sm"
              >
                删除
              </button>
            </div>
          </div>
        </article>
      </div>

      {children.length > 0 ? (
        <ul className="m-0 p-0">
          {children.map((child, childIndex) => (
            <TaskRow
              key={child.task.id}
              node={child}
              depth={depth + 1}
              index={childIndex}
              actionId={actionId}
              onToggle={onToggle}
              onDelete={onDelete}
              onBreakdown={onBreakdown}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

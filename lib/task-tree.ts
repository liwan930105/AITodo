import type { TaskRecord } from "./task-types";

export type TaskNode = {
  task: TaskRecord;
  children: TaskNode[];
};

const sortByCreatedDesc = (items: TaskRecord[]): TaskRecord[] => {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const buildTaskTree = (tasks: TaskRecord[]): TaskNode[] => {
  const byParent = new Map<string | null, TaskRecord[]>();

  for (const task of tasks) {
    const key = task.parent_id;
    const group = byParent.get(key);
    if (group) {
      group.push(task);
    } else {
      byParent.set(key, [task]);
    }
  }

  const buildNodes = (parentId: string | null): TaskNode[] => {
    return sortByCreatedDesc(byParent.get(parentId) ?? []).map((task) => ({
      task,
      children: buildNodes(task.id)
    }));
  };

  return buildNodes(null);
};

export const removeTaskAndDescendants = (tasks: TaskRecord[], taskId: string): TaskRecord[] => {
  const toRemove = new Set<string>();

  const collect = (id: string): void => {
    toRemove.add(id);
    for (const task of tasks) {
      if (task.parent_id === id) {
        collect(task.id);
      }
    }
  };

  collect(taskId);
  return tasks.filter((task) => !toRemove.has(task.id));
};

export const mergeTasks = (current: TaskRecord[], incoming: TaskRecord[]): TaskRecord[] => {
  const map = new Map(current.map((task) => [task.id, task]));
  for (const task of incoming) {
    map.set(task.id, task);
  }
  return Array.from(map.values());
};

export const TASK_STATUSES = ["pending", "completed"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  parent_id: string | null;
  created_at: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  parentId?: string | null;
};

export type UpdateTaskStatusInput = {
  status: TaskStatus;
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const isUUID = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const isTaskStatus = (value: unknown): value is TaskStatus => {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
};

export const validateCreateTaskInput = (body: unknown): CreateTaskInput | null => {
  if (!isPlainObject(body)) {
    return null;
  }

  const title = body.title;
  const description = body.description;
  const parentId = body.parentId;

  if (typeof title !== "string" || title.trim().length === 0) {
    return null;
  }

  if (
    typeof description !== "undefined" &&
    description !== null &&
    typeof description !== "string"
  ) {
    return null;
  }

  if (
    typeof parentId !== "undefined" &&
    parentId !== null &&
    (typeof parentId !== "string" || !isUUID(parentId))
  ) {
    return null;
  }

  return {
    title: title.trim(),
    description: typeof description === "undefined" ? undefined : description,
    parentId: typeof parentId === "undefined" ? undefined : parentId
  };
};

export const validateUpdateTaskStatusInput = (body: unknown): UpdateTaskStatusInput | null => {
  if (!isPlainObject(body)) {
    return null;
  }

  if (!isTaskStatus(body.status)) {
    return null;
  }

  return { status: body.status };
};

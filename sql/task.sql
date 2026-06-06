-- 任务状态枚举
CREATE TYPE task_status AS ENUM ('pending', 'completed');

-- 任务表
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  status      task_status NOT NULL DEFAULT 'pending',
  parent_id   UUID REFERENCES tasks (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_parent_id ON tasks (parent_id);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);

-- 注释（可选）
COMMENT ON TABLE tasks IS '待办事项表';
COMMENT ON COLUMN tasks.parent_id IS '父任务 ID，用于关联 AI 拆解的子任务';

-- 行级安全策略（使用 anon / publishable key 时需要；service_role key 会绕过 RLS）
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_all"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "tasks_insert_all"
  ON tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "tasks_update_all"
  ON tasks FOR UPDATE
  USING (true);

CREATE POLICY "tasks_delete_all"
  ON tasks FOR DELETE
  USING (true);

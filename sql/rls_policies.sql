-- Run this if tasks table already exists but API writes fail with RLS errors.

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_all" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON tasks;
DROP POLICY IF EXISTS "tasks_update_all" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_all" ON tasks;

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

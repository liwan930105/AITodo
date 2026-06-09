# AITodo
这是一个通过cursor编码实现的清单待办事项项目

## API Routes

This project now includes Next.js API Routes backed by Supabase:

- `GET /api/tasks`: Get all tasks ordered by `created_at` descending.
- `POST /api/tasks`: Create a task.
- `PATCH /api/tasks/[id]`: Update task status.
- `DELETE /api/tasks/[id]`: Delete a task.

## Database setup

Run `sql/task.sql` in the Supabase SQL Editor to create the `tasks` table and RLS policies.

## Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Notes:

- `SUPABASE_URL` must be the project base URL (no `/rest/v1/` suffix).
- `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** secret from Supabase Dashboard → Settings → API.
- Do not use the `publishable` key here. If you only have a publishable key, run the RLS policies in `sql/task.sql` and expect permission errors until policies are applied.

## technology stack
前端:React+Tailwind CSS(Al写UI)
后端:Next.jsAPIRoutes(AI写逻辑)
数据库:Supabase(云端，零配置)
AI集成:DeepSeek

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the Todo UI.

## development guide
https://blog.csdn.net/liwan09/article/details/161830446?spm=1001.2014.3001.5501

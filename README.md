# AITodo
AI TodoList

## API Routes

This project now includes Next.js API Routes backed by Supabase:

- `GET /api/tasks`: Get all tasks ordered by `created_at` descending.
- `POST /api/tasks`: Create a task.
- `PATCH /api/tasks/[id]`: Update task status.
- `DELETE /api/tasks/[id]`: Delete a task.

## Environment variables

Create a `.env.local` file:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Run

```bash
npm install
npm run dev
```

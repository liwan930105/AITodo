import type { NextApiRequest, NextApiResponse } from "next";
import type { PostgrestError } from "@supabase/supabase-js";
import { breakdownTaskWithDeepSeek } from "../../../lib/deepseek";
import { getSupabaseServerClient } from "../../../lib/supabase";
import { type TaskRecord, validateBreakdownTaskInput } from "../../../lib/task-types";

type ErrorResponse = {
  error: string;
};

type BreakdownTaskResponse = {
  data: {
    parent: TaskRecord;
    subtasks: TaskRecord[];
    steps: string[];
  };
};

const mapSupabaseError = (error: PostgrestError): { statusCode: number; message: string } => {
  switch (error.code) {
    case "23503":
      return { statusCode: 400, message: "Invalid parentId: parent task does not exist." };
    case "22P02":
      return { statusCode: 400, message: "Invalid input format." };
    case "42501":
      return {
        statusCode: 403,
        message:
          "Database permission denied. Use SUPABASE_SERVICE_ROLE_KEY or apply RLS policies from sql/task.sql."
      };
    default:
      return { statusCode: 500, message: "Database operation failed." };
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BreakdownTaskResponse | ErrorResponse>
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const parsedBody = validateBreakdownTaskInput(req.body);
    if (!parsedBody) {
      res.status(400).json({
        error: "Invalid request body. Expected { taskId: UUID; title: string }."
      });
      return;
    }

    const supabase = getSupabaseServerClient();

    const { data: parentTask, error: parentError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", parsedBody.taskId)
      .maybeSingle();

    if (parentError) {
      const mapped = mapSupabaseError(parentError);
      res.status(mapped.statusCode).json({ error: mapped.message });
      return;
    }

    if (!parentTask) {
      res.status(404).json({ error: "Parent task not found." });
      return;
    }

    const steps = await breakdownTaskWithDeepSeek(parsedBody.title);

    const insertPayload = steps.map((title) => ({
      title,
      parent_id: parsedBody.taskId
    }));

    const { data: subtasks, error: insertError } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("*");

    if (insertError) {
      const mapped = mapSupabaseError(insertError);
      res.status(mapped.statusCode).json({ error: mapped.message });
      return;
    }

    res.status(201).json({
      data: {
        parent: parentTask as TaskRecord,
        subtasks: (subtasks ?? []) as TaskRecord[],
        steps
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while breaking down task.";
    res.status(500).json({ error: message });
  }
}

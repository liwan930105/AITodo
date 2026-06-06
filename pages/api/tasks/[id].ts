import type { NextApiRequest, NextApiResponse } from "next";
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "../../../lib/supabase";
import {
  type TaskRecord,
  isUUID,
  validateUpdateTaskStatusInput
} from "../../../lib/task-types";

type ErrorResponse = {
  error: string;
};

type TaskResponse = {
  data: TaskRecord;
};

type DeleteTaskResponse = {
  data: {
    id: string;
  };
};

const respondMethodNotAllowed = (res: NextApiResponse<ErrorResponse>, allowed: string[]): void => {
  res.setHeader("Allow", allowed);
  res.status(405).json({ error: "Method Not Allowed" });
};

const extractTaskId = (value: string | string[] | undefined): string | null => {
  if (typeof value !== "string" || !isUUID(value)) {
    return null;
  }
  return value;
};

const mapSupabaseError = (error: PostgrestError): { statusCode: number; message: string } => {
  switch (error.code) {
    case "PGRST116":
      return { statusCode: 404, message: "Task not found." };
    case "22P02":
      return { statusCode: 400, message: "Invalid id format." };
    default:
      return { statusCode: 500, message: "Database operation failed." };
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TaskResponse | DeleteTaskResponse | ErrorResponse>
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const taskId = extractTaskId(req.query.id);

    if (!taskId) {
      res.status(400).json({ error: "Invalid route parameter: id must be a UUID." });
      return;
    }

    if (req.method === "PATCH") {
      const parsedBody = validateUpdateTaskStatusInput(req.body);
      if (!parsedBody) {
        res.status(400).json({
          error: "Invalid request body. Expected { status: 'pending' | 'completed' }."
        });
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({ status: parsedBody.status })
        .eq("id", taskId)
        .select("*")
        .maybeSingle();

      if (error) {
        const mapped = mapSupabaseError(error);
        res.status(mapped.statusCode).json({ error: mapped.message });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "Task not found." });
        return;
      }

      res.status(200).json({ data: data as TaskRecord });
      return;
    }

    if (req.method === "DELETE") {
      const { data, error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .select("id")
        .maybeSingle();

      if (error) {
        const mapped = mapSupabaseError(error);
        res.status(mapped.statusCode).json({ error: mapped.message });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "Task not found." });
        return;
      }

      res.status(200).json({ data: { id: taskId } });
      return;
    }

    respondMethodNotAllowed(res, ["PATCH", "DELETE"]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while handling task item API.";
    res.status(500).json({ error: message });
  }
}

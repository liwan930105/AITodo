import type { NextApiRequest, NextApiResponse } from "next";
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "../../../lib/supabase";
import {
  type TaskRecord,
  validateCreateTaskInput
} from "../../../lib/task-types";

type ErrorResponse = {
  error: string;
};

type GetTasksResponse = {
  data: TaskRecord[];
};

type CreateTaskResponse = {
  data: TaskRecord;
};

const respondMethodNotAllowed = (res: NextApiResponse<ErrorResponse>, allowed: string[]): void => {
  res.setHeader("Allow", allowed);
  res.status(405).json({ error: "Method Not Allowed" });
};

const mapSupabaseError = (error: PostgrestError): { statusCode: number; message: string } => {
  switch (error.code) {
    case "23503":
      return { statusCode: 400, message: "Invalid parentId: parent task does not exist." };
    case "22P02":
      return { statusCode: 400, message: "Invalid input format." };
    default:
      return { statusCode: 500, message: "Database operation failed." };
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetTasksResponse | CreateTaskResponse | ErrorResponse>
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        const mapped = mapSupabaseError(error);
        res.status(mapped.statusCode).json({ error: mapped.message });
        return;
      }

      res.status(200).json({ data: (data ?? []) as TaskRecord[] });
      return;
    }

    if (req.method === "POST") {
      const parsedBody = validateCreateTaskInput(req.body);
      if (!parsedBody) {
        res.status(400).json({
          error: "Invalid request body. Expected { title: string; description?: string | null; parentId?: UUID | null }."
        });
        return;
      }

      const insertPayload: {
        title: string;
        description?: string | null;
        parent_id?: string | null;
      } = { title: parsedBody.title };

      if (typeof parsedBody.description !== "undefined") {
        insertPayload.description = parsedBody.description;
      }

      if (typeof parsedBody.parentId !== "undefined") {
        insertPayload.parent_id = parsedBody.parentId;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) {
        const mapped = mapSupabaseError(error);
        res.status(mapped.statusCode).json({ error: mapped.message });
        return;
      }

      res.status(201).json({ data: data as TaskRecord });
      return;
    }

    respondMethodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error while handling tasks API.";
    res.status(500).json({ error: message });
  }
}

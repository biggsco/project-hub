import { z } from "zod";
import { captureDefaultsSchema } from "./model";
export const pendingCaptureSchema = z.object({
  request_id: z.string().uuid(),
  lines: z.array(z.string().trim().min(1).max(1000)).min(1).max(200),
  defaults: captureDefaultsSchema,
});
export function recoverCaptures(raw: string | null) {
  try {
    return z
      .array(pendingCaptureSchema)
      .max(200)
      .parse(JSON.parse(raw || "[]"));
  } catch {
    return [];
  }
}
export function recoverDraft(raw: string | null) {
  return typeof raw === "string" ? raw.slice(0, 1000) : "";
}

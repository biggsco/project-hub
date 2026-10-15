import { advanceRecurring, recurrenceAction } from "@/lib/recurrence-records";
import { workbenchAction } from "@/lib/workbench-records";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { loadRecords, writeRecord, captureTasks } from "@/lib/records";
import { saveContact, recordVisit, peopleRecords } from "@/lib/people-records";
import { z } from "zod";
import { organise, organisationRecords } from "@/lib/organisation-records";
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (req.nextUrl.searchParams.get("history") === "1")
      return NextResponse.json(
        await asUser(user.id, async (c) => ({
          project_completions: (
            await c.query(
              "select id,entity_id,title,created_at from activity where entity_type='projects' and changes->'status'->>'to'='Completed' order by created_at desc limit 500",
            )
          ).rows,
        })),
        { headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      await asUser(user.id, async (c) => {
        await advanceRecurring(c, user.id);
        return loadRecords(c);
      }),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to load the workspace. Check database setup and try again.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || req.nextUrl.origin).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const b = await req.json();
    if (
      [
        "progress_add",
        "reference_save",
        "reference_delete",
        "steps_import",
        "subtasks_reorder",
        "followed_up",
      ].includes(b.action)
    )
      return NextResponse.json(
        await asUser(user.id, (c) => workbenchAction(c, user.id, b)),
      );
    if (b.action === "recurrence")
      return NextResponse.json({
        record: await asUser(user.id, (c) => recurrenceAction(c, user.id, b)),
      });
    if (b.action === "visit")
      return NextResponse.json(
        await asUser(user.id, (c) => recordVisit(c, user.id)),
      );
    if (["team_save", "person_save"].includes(b.action))
      return NextResponse.json({
        record: await asUser(user.id, (c) => saveContact(c, user.id, b)),
      });
    if (b.action === "capture") {
      const records = await asUser(user.id, (c) => captureTasks(c, user.id, b));
      return NextResponse.json({
        records,
        ...(await asUser(user.id, organisationRecords)),
      });
    }
    if (["bucket_save", "bucket_reorder", "tag_save"].includes(b.action)) {
      const record = await asUser(user.id, (c) => organise(c, user.id, b));
      return NextResponse.json({ record });
    }
    const table = z.enum(["tasks", "projects"]).parse(b.table);
    const action = z.enum(["save", "delete"]).parse(b.action);
    const id = b.id ? z.string().uuid().parse(b.id) : null;
    const result = await asUser(user.id, async (c) => ({
      record: await writeRecord(c, user.id, table, action, b.value, id),
      ...(table === "tasks" ? await peopleRecords(c) : {}),
    }));
    return NextResponse.json(result);
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message =
      e instanceof z.ZodError
        ? "Check required fields and dates."
        : e instanceof Error &&
            /steps|progress|references|Import request|Refresh|http or https/.test(
              e.message,
            )
          ? e.message
          : code === "23505"
            ? "That name already exists. Choose another name or merge the tags."
            : code === "23503"
              ? "Unlink dependent tasks before deleting, and only link records in your workspace."
              : code === "P0001"
                ? "Subtasks cannot form a loop."
                : "Unable to save. Check the record and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

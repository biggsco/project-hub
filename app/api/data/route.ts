import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { loadRecords, writeRecord, captureTasks } from "@/lib/records";
import { z } from "zod";
import { organise, organisationRecords } from "@/lib/organisation-records";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    return NextResponse.json(await asUser(user.id, loadRecords), {
      headers: { "Cache-Control": "no-store" },
    });
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
    const record = await asUser(user.id, (c) =>
      writeRecord(c, user.id, table, action, b.value, id),
    );
    return NextResponse.json({ record });
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message =
      e instanceof z.ZodError
        ? "Check required fields and dates."
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

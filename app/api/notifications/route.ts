import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import {
  notificationSettings,
  saveNotificationSettings,
  queueTest,
} from "@/lib/notification-records";
import { deliverUser } from "@/lib/jobs";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    return NextResponse.json(
      {
        ...(await asUser(user.id, (c) => notificationSettings(c, user.id))),
        scheduler_configured: (process.env.HUB_JOB_SECRET || "").length >= 32,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load notifications" },
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
    if (b.action === "test") {
      const testId = await asUser(user.id, (c) =>
        queueTest(
          c,
          user.id,
          process.env.BETTER_AUTH_URL || req.nextUrl.origin,
        ),
      );
      await deliverUser(
        user.id,
        process.env.BETTER_AUTH_SECRET || "",
        1,
        testId,
      );
      return NextResponse.json(
        await asUser(user.id, (c) => notificationSettings(c, user.id)),
      );
    }
    if (b.action !== "save")
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json(
      await asUser(user.id, (c) =>
        saveNotificationSettings(
          c,
          user.id,
          b,
          process.env.BETTER_AUTH_SECRET || "",
        ),
      ),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to save or test. Use a signed Microsoft Teams Workflow HTTPS URL, confirm tenant access and check the connection status. The URL is never returned.",
      },
      { status: 400 },
    );
  }
}

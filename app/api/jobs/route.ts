import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runJobs } from "@/lib/jobs";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const secret = process.env.HUB_JOB_SECRET,
    provided = req.headers.get("authorization") || "";
  if (!secret || secret.length < 32)
    return NextResponse.json(
      { error: "Scheduled jobs are not configured" },
      { status: 503 },
    );
  const expected = Buffer.from("Bearer " + secret),
    actual = Buffer.from(provided);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    return NextResponse.json(await runJobs());
  } catch {
    return NextResponse.json(
      { error: "Scheduled jobs failed. Check database setup." },
      { status: 503 },
    );
  }
}

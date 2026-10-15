import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { z } from "zod";
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || req.nextUrl.origin).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const b = await req.json();
    let path: string, body: Record<string, unknown>;
    if (b.action === "logout") {
      path = "/sign-out";
      body = {};
    } else if (b.action === "reset")
      return NextResponse.json(
        {
          error:
            "Password recovery is available through your Render dashboard. Open the service Shell and run npm run account:reset.",
        },
        { status: 400 },
      );
    else if (b.action === "password") {
      path = "/change-password";
      body = {
        newPassword: z.string().min(12).max(128).parse(b.password),
        currentPassword: z.string().min(1).parse(b.currentPassword),
        revokeOtherSessions: true,
      };
    } else {
      path = "/sign-in/email";
      body = {
        email: z.string().email().parse(b.email),
        password: z.string().min(1).max(128).parse(b.password),
      };
    }
    const headers = new Headers(req.headers);
    headers.set("Content-Type", "application/json");
    const response = await getAuth().handler(
      new Request(new URL("/api/auth" + path, process.env.BETTER_AUTH_URL), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    if (!response.ok) {
      const b = await response.json();
      return NextResponse.json(
        { error: b.message || "Unable to sign in or update your password." },
        {
          status: response.status,
          headers:
            response.status === 429
              ? { "Retry-After": response.headers.get("x-retry-after") || "60" }
              : {},
        },
      );
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "Check your details and try again." },
      { status: 400 },
    );
  }
}

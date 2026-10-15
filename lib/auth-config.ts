import type { BetterAuthOptions } from "better-auth";
export function authOptions(
  database: BetterAuthOptions["database"],
  settings?: { url: string; secret: string; ownerEmail: string },
): BetterAuthOptions {
  const url = settings?.url || process.env.BETTER_AUTH_URL;
  const secret = settings?.secret || process.env.BETTER_AUTH_SECRET;
  const email = settings?.ownerEmail || process.env.OWNER_EMAIL;
  if (!url || !secret || secret.length < 32 || !email)
    throw Error("Authentication is not configured");
  return {
    database,
    baseURL: url,
    secret,
    trustedOrigins: [new URL(url).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: url.startsWith("https://"),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
  };
}

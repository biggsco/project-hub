"use client";
import { useState } from "react";
export default function Login({
  setup = false,
  denied = false,
}: {
  setup?: boolean;
  denied?: boolean;
}) {
  const [reset, setReset] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reset ? "reset" : "login",
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (reset)
        setMessage("If the account exists, a reset link has been sent.");
      else location.assign("/");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand-mark">P</div>
        <p className="eyebrow">PROJECT HUB</p>
        <h1>
          A clear head.
          <br />A focused day.
        </h1>
        <p className="muted">
          Your projects, priorities and next steps, together.
        </p>
        {setup ? (
          <div className="notice">
            <strong>Ready for database setup</strong>
            <p>
              Configure your Render database and authentication settings using
              the deployment guide. No tasks are stored until setup is complete.
            </p>
          </div>
        ) : denied ? (
          <div className="notice">
            This account is not authorised.
            <button
              onClick={async () => {
                await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                location.reload();
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            {!reset && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : reset ? "Send reset link" : "Sign in"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setReset(!reset)}
            >
              {reset ? "Back to sign in" : "Forgot password?"}
            </button>
          </form>
        )}
        <p role="status">{message}</p>
        <small className="muted">Private workspace · Australia/Adelaide</small>
      </div>
    </main>
  );
}

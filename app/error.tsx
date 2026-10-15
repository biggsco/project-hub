"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="login">
      <section className="login-card">
        <h1>Workspace unavailable</h1>
        <p className="muted">
          We couldn’t load your workspace. Try again in a moment.
        </p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

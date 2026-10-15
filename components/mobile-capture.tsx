"use client";
import { useEffect, useState } from "react";
import QuickAdd from "./quick-add";
export default function MobileCapture({ email }: { email: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/data");
      if (!r.ok)
        throw Error("Unable to load capture. Reconnect and try again.");
      setData(await r.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (data)
      document
        .querySelector<HTMLInputElement>('[aria-label="Quick Add task"]')
        ?.focus();
  }, [!!data]);
  return (
    <main className="mobile-capture">
      <div className="section-heading">
        <h1>Quick Capture</h1>
        <a href="/">Workspace</a>
      </div>
      <p className="muted">
        Capture first. Organise later. Device keyboard dictation works here.
      </p>
      {error && (
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      {data ? (
        <QuickAdd
          draftKey={`hub-capture:${email}`}
          compact
          buckets={data.buckets}
          tags={data.tags}
          teams={data.teams}
          people={data.people}
          contextKey="mobile"
          onCreateBucket={async (name) => {
            const r = await fetch("/api/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "bucket_save", value: { name } }),
            });
            if (!r.ok) return null;
            const b = await r.json();
            setData((d: any) => ({ ...d, buckets: [...d.buckets, b.record] }));
            return b.record;
          }}
          onCreated={(_records, tags, directory) =>
            setData((d: any) => ({ ...d, tags, ...directory }))
          }
        />
      ) : (
        <p>Loading capture…</p>
      )}
      <p className="muted">
        Drafts and unconfirmed saves stay on this device. Reconnect and use
        Retry; the same submission will not create duplicates.
      </p>
    </main>
  );
}

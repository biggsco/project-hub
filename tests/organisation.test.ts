import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskInput, boundedPreview } from "../lib/capture";
import {
  canonicalTags,
  orderedBuckets,
  type Bucket,
  type Tag,
} from "../lib/organisation";
const buckets: Bucket[] = [
  {
    id: "vwx",
    name: "Vectorworks (VWX)",
    description: "",
    aliases: ["VWX", "Vectorworks"],
    position: 0,
    archived: false,
  },
  {
    id: "momentus",
    name: "Momentus",
    description: "",
    aliases: [],
    position: 1,
    archived: false,
  },
  {
    id: "myavm",
    name: "MyAVM / SharePoint",
    description: "",
    aliases: ["MyAVM", "SharePoint"],
    position: 2,
    archived: false,
  },
];
const tags: Tag[] = [
  { id: "1", name: "Documentation" },
  { id: "2", name: "Improvement" },
  { id: "3", name: "Quick Win" },
];
const parse = (s: string) => parseTaskInput(s, buckets, tags, "2026-10-15");
test("known bucket prefixes and aliases preserve independent classification", () => {
  assert.deepEqual(parse("VWX - investigate data tag coordinates"), {
    title: "investigate data tag coordinates",
    classification: "Standard",
    bucket_id: "vwx",
    project_id: null,
    task_type: "To Do",
    team_id: null,
    person_id: null,
    follow_up_date: null,
    due_date: null,
    date_preferences: {},
    tags: [],
  });
  assert.equal(
    parse("Momentus - review webhook options in 2 weeks").due_date,
    "2026-10-29",
  );
  for (const s of [
    "Downtime - VWX - tidy symbols",
    "VWX - Downtime - tidy symbols",
  ]) {
    const p = parse(s);
    assert.equal(p.classification, "Downtime");
    assert.equal(p.bucket_id, "vwx");
    assert.equal(p.title, "tidy symbols");
  }
});
test("incidental bucket mentions retain meaningful title words", () => {
  const p = parse("Update MyAVM documentation #documentation #improvement");
  assert.equal(p.bucket_id, "myavm");
  assert.equal(p.title, "Update MyAVM documentation");
  assert.deepEqual(p.tags, ["Documentation", "Improvement"]);
  assert.equal(parse("Compare Momentus with SharePoint").bucket_id, null);
  assert.equal(parse("MomentusX research").bucket_id, null);
});
test("ambiguous aliases, unknown prefixes and archived buckets are not stripped", () => {
  const ambiguous = [...buckets, { ...buckets[1], aliases: ["VWX"] }];
  assert.equal(
    parseTaskInput("VWX - check symbols", ambiguous, tags).title,
    "VWX - check symbols",
  );
  assert.equal(
    parseTaskInput("VWX - check symbols", ambiguous, tags).bucket_id,
    null,
  );
  assert.equal(
    parse("Unknown - check symbols").title,
    "Unknown - check symbols",
  );
  const archived = buckets.map((b) => ({ ...b, archived: true }));
  assert.equal(
    parseTaskInput("VWX - check symbols", archived, tags).bucket_id,
    null,
  );
});
test("selected metadata applies without changing classification; recognised text overrides defaults", () => {
  const p = parseTaskInput("Review documents", buckets, tags, "2026-10-15", {
    bucket_id: "vwx",
    classification: "Ongoing",
    tags: ["Documentation"],
    date_preferences: { due_date: "Someday" },
  });
  assert.equal(p.classification, "Ongoing");
  assert.equal(p.bucket_id, "vwx");
  assert.equal(p.date_preferences.due_date, "Someday");
  const explicit = parseTaskInput(
    "Downtime - Momentus - inspect tomorrow #research",
    buckets,
    tags,
    "2026-10-15",
    {
      bucket_id: "vwx",
      classification: "Ongoing",
      due_date: "2026-12-01",
      date_preferences: { due_date: "Someday" },
    },
  );
  assert.equal(explicit.classification, "Downtime");
  assert.equal(explicit.bucket_id, "momentus");
  assert.equal(explicit.due_date, "2026-10-16");
  assert.deepEqual(explicit.date_preferences, {});
});
test("hashtag parsing deduplicates and respects unsupported meaningful hashes", () => {
  const p = parse("Check docs #documentation #Documentation #quick-win");
  assert.deepEqual(p.tags, ["Documentation", "Quick Win"]);
  assert.equal(parse("Review C# compiler").title, "Review C# compiler");
  assert.equal(parse("#documentation").title, "#documentation");
  assert.equal(
    parse("Call supplier tomorrow #research").due_date,
    "2026-10-16",
  );
  assert.equal(
    parse("Call supplier Friday or tomorrow #research").due_date,
    null,
  );
  assert.deepEqual(
    canonicalTags([" Research ", "research", "Quick   Win"], tags),
    ["Research", "Quick Win"],
  );
});
test("Brain Dump bounds parsed/renderable items before building a large preview", () => {
  const p = boundedPreview(
    Array(20000).fill("VWX - investigate #research").join("\n"),
    buckets,
    tags,
    "2026-10-15",
  );
  assert.equal(p.count, 20000);
  assert.equal(p.items.length, 200);
  assert.equal(p.items[0].bucket_id, "vwx");
});
test("recent buckets rank first and archived buckets stay out of capture", () => {
  assert.equal(orderedBuckets(buckets, ["myavm"])[0].id, "myavm");
  assert.equal(
    orderedBuckets(
      buckets.map((b) => ({ ...b, archived: b.id === "myavm" })),
      ["myavm"],
    )[0].id,
    "vwx",
  );
});

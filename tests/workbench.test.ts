import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSteps,
  generatePrompt,
  promptContext,
  promptModes,
  referenceSchema,
  csvCell,
} from "../lib/workbench";
import { taskSchema } from "../lib/model";
const make = (v: any) => ({
  ...taskSchema.parse(v),
  id: crypto.randomUUID(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
});
test("step imports recognise supported formats and reject unsafe or ambiguous input", () => {
  assert.deepEqual(
    parseSteps("1. Investigate\n2) Build\n- [ ] Test\n- [x] investigate"),
    ["Investigate", "Build", "Test"],
  );
  assert.deepEqual(
    parseSteps('```json\n{"steps":["One",{"title":"Two"}]}\n```'),
    ["One", "Two"],
  );
  assert.throws(() => parseSteps("Just an explanation"), /No steps/);
  assert.throws(() => parseSteps('{"steps":'), /Invalid JSON/);
  assert.throws(() => parseSteps(JSON.stringify({ steps: ["x".repeat(256)] })));
  assert.throws(
    () =>
      parseSteps(
        Array.from({ length: 101 }, (_, i) => `${i + 1}. Step ${i}`).join("\n"),
      ),
    /100 steps/,
  );
});
test("prompt templates include only selected existing context and support all four modes", () => {
  const task = make({
    title: "Build workbench",
    notes: "private note",
    next_action: "Inspect code",
    progress_entries: [
      {
        id: crypto.randomUUID(),
        text: "Investigated schema",
        kind: "progress",
        created_at: new Date().toISOString(),
      },
    ],
  });
  const parts = promptContext(task, [], undefined, undefined, {
    teams: [],
    people: [],
  });
  for (const mode of promptModes) {
    const prompt = generatePrompt(mode, parts, ["title", "next"], "No APIs");
    assert.ok(prompt.includes(task.title));
    assert.ok(prompt.includes("Inspect code"));
    assert.ok(prompt.includes("No APIs"));
    assert.ok(!prompt.includes("private note"));
    assert.ok(!prompt.includes("Investigated schema"));
    assert.ok(!prompt.includes("Project:"));
  }
  assert.ok(
    generatePrompt("Break into Steps", parts, ["title"]).includes(
      "importable Markdown checklist",
    ),
  );
});
test("reference URLs reject script/data schemes and CSV blocks formula execution", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
  ]) {
    assert.equal(
      referenceSchema.safeParse({
        id: crypto.randomUUID(),
        title: "Link",
        url,
        created_at: new Date().toISOString(),
      }).success,
      false,
    );
  }
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell('Hello "world"'), '"Hello ""world"""');
});

test("ideas and notes remain outside the actionable workload and preserve date wording", async () => {
  const { parseTaskInput, actionable } = await import("../lib/capture");
  const { recommendTasks, needsAttention } =
    await import("../lib/productivity");
  const note = make(
    parseTaskInput("Idea for tomorrow", [], [], "2026-10-15", {
      content_type: "Idea",
    }),
  );
  assert.equal(note.title, "Idea for tomorrow");
  assert.equal(note.due_date, null);
  assert.equal(note.content_type, "Idea");
  assert.equal(actionable(note), false);
  assert.equal(recommendTasks([note]).length, 0);
  assert.equal(needsAttention([note]).length, 0);
});
test("recoverable capture drafts validate persisted payloads and retain idempotency IDs", async () => {
  const { recoverCaptures, recoverDraft } =
    await import("../lib/capture-drafts");
  const payload = {
    request_id: crypto.randomUUID(),
    lines: ["Check this"],
    defaults: { content_type: "Note" },
  };
  assert.deepEqual(recoverCaptures(JSON.stringify([payload])), [payload]);
  assert.deepEqual(recoverCaptures("not json"), []);
  assert.deepEqual(recoverCaptures('[{"request_id":"bad"}]'), []);
  assert.equal(recoverDraft("x".repeat(2000)).length, 1000);
});

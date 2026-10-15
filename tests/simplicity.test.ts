import test from "node:test";
import assert from "node:assert/strict";
import { captureContextDefaults, parseTaskInput } from "../lib/capture";
import { taskSchema, captureDefaultsSchema } from "../lib/model";
import { matchesTags } from "../lib/organisation";
test("general views have no sticky metadata and capture into Inbox without priority", () => {
  for (const section of [
    "Dashboard",
    "Inbox",
    "My Tasks",
    "Projects",
    "Calendar",
  ]) {
    const defaults = captureContextDefaults(section);
    const task = taskSchema.parse(
      parseTaskInput("Remember this", [], [], "2026-10-15", defaults),
    );
    assert.equal(task.status, "Inbox");
    assert.equal(task.classification, "Standard");
    assert.equal(task.priority, "None");
    assert.equal(task.bucket_id, null);
    assert.equal(task.project_id, null);
    assert.equal(task.due_date, null);
    assert.deepEqual(task.tags, []);
  }
});
test("bucket, ongoing and project contexts affect only their explicit defaults", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const project = "22222222-2222-4222-8222-222222222222";
  assert.equal(
    captureContextDefaults("Downtime", id).classification,
    "Downtime",
  );
  assert.equal(
    captureContextDefaults("My Tasks", id).classification,
    "Standard",
  );
  assert.equal(captureContextDefaults("Ongoing").classification, "Ongoing");
  const parsed = taskSchema.parse(
    parseTaskInput(
      "Project task",
      [],
      [],
      "2026-10-15",
      captureContextDefaults("Projects", id, project),
    ),
  );
  assert.equal(parsed.project_id, project);
  assert.equal(parsed.bucket_id, id);
  assert.equal(parsed.classification, "Standard");
  const explicit = parseTaskInput(
    "Ongoing - Maintain docs",
    [],
    [],
    "2026-10-15",
    captureContextDefaults("Downtime", id, project),
  );
  assert.equal(explicit.classification, "Ongoing");
  assert.equal(explicit.project_id, project);
  assert.equal(explicit.bucket_id, id);
});
test("legacy Inbox classification inputs are normalised without changing task status", () => {
  const task = taskSchema.parse({
    title: "Old task",
    classification: "Inbox",
    status: "In Progress",
    priority: "High",
  });
  assert.equal(task.classification, "Standard");
  assert.equal(task.status, "In Progress");
  assert.equal(task.priority, "High");
  assert.deepEqual(captureDefaultsSchema.parse({ classification: "Inbox" }), {
    classification: "Standard",
  });
});
test("multi-tag filtering requires all selected tags and ignores case or whitespace", () => {
  assert.equal(
    matchesTags(["Automation", "Research"], [" automation ", "RESEARCH"]),
    true,
  );
  assert.equal(matchesTags(["Automation"], ["Automation", "Research"]), false);
  assert.equal(matchesTags([], []), true);
});

import { getPool } from "../lib/db";
import { provision } from "../lib/provision";
import { createInterface } from "node:readline/promises";
const reset = process.argv.includes("--reset");
const email = process.env.OWNER_EMAIL;
if (!email) throw Error("Set OWNER_EMAIL in Render Environment first");
function password(prompt: string): Promise<string> {
  if (!process.stdin.isTTY)
    throw Error(
      "Open an interactive terminal. Passwords are never accepted in arguments.",
    );
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const handler = (chunk: Buffer) => {
      for (const c of chunk.toString()) {
        if (c === "\r" || c === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") {
          cleanup();
          reject(Error("Cancelled"));
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else if (c >= " ") value += c;
      }
    };
    function cleanup() {
      process.stdin.off("data", handler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    process.stdin.on("data", handler);
  });
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const name = reset ? "" : await rl.question("Display name: ");
rl.close();
const first = await password(
  reset ? "New password (hidden): " : "Password (hidden): ",
);
const second = await password("Confirm password (hidden): ");
if (first !== second) throw Error("Passwords do not match");
const pool = getPool(),
  c = await pool.connect();
try {
  await c.query("BEGIN");
  await provision(c, email, name || "Scott", first, reset);
  await c.query("COMMIT");
  console.log(
    reset
      ? "Password reset; all sessions revoked."
      : "Owner account created. Public registration remains disabled.",
  );
} catch (e) {
  await c.query("ROLLBACK");
  console.error(e instanceof Error ? e.message : "Account operation failed");
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}

import { z } from "zod";
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");
export const nameKey = (s: string) => cleanName(s).toLowerCase();
const name = z.string().transform(cleanName).pipe(z.string().min(1).max(100));
export const bucketSchema = z.object({
  name,
  description: z.string().max(4000).default(""),
  aliases: z.array(name).max(20).default([]),
  position: z.number().int().min(0).max(100000).default(0),
  archived: z.boolean().default(false),
});
export type Bucket = z.output<typeof bucketSchema> & { id: string };
export type Tag = { id: string; name: string };
export function canonicalTags(names: string[], library: Tag[] = []) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const input of names) {
    const key = nameKey(input);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(
      library.find((t) => nameKey(t.name) === key)?.name || cleanName(input),
    );
  }
  return result;
}
export function orderedBuckets(buckets: Bucket[], recent: string[] = []) {
  return buckets
    .filter((b) => !b.archived)
    .toSorted((a, b) => {
      const ai = recent.indexOf(a.id),
        bi = recent.indexOf(b.id);
      return (
        (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) ||
        a.position - b.position ||
        a.name.localeCompare(b.name)
      );
    });
}

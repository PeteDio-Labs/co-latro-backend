import { Glob } from "bun";
/**
 * Tags catalog — Balatro's skip-blind reward tokens (and other trigger-based one-shots).
 * PURE DATA. PET-78 populates the initial set; some effects (free_pack/free_voucher)
 * are deferred markers until PET-70 wires packs.
 *
 * applyTags in run.ts iterates run.tags and fires the ones whose trigger matches the phase.
 */

export type TagTrigger =
  | "on_shop_enter"
  | "on_pack_open"
  | "immediate"
  | "on_next_blind_start"
  | "on_blind_skip";

export type TagEffect =
  | { kind: "money_add"; n: number }
  | { kind: "free_pack"; packKind: string }
  | { kind: "mult_add_next_hand"; n: number }
  | { kind: "free_voucher" }
  | { kind: "extra_joker_now"; rarity: "common" | "uncommon" | "rare" };

export interface TagDef {
  id: string;
  name: string;
  description: string;
  trigger: TagTrigger;
  effect: TagEffect;
}

// Catalog assembled from ./tags/*.ts — ONE FILE PER ENTRY (PET-216). Additive entries are
// new files, never a shared-array edit, so additive PRs cannot merge-conflict. Sorted by id.
const _tagsDir = new URL("./tags/", import.meta.url).pathname;
const _tagsFiles = [...new Glob("*.ts").scanSync({ cwd: _tagsDir, absolute: true })]
  .filter((f) => !(f.split("/").pop() ?? "").startsWith("_"))
  .sort();
export const TAGS: TagDef[] = _tagsFiles.map((f) => require(f).default as TagDef);

export const TAG_BY_ID = new Map<string, TagDef>(TAGS.map((t) => [t.id, t]));

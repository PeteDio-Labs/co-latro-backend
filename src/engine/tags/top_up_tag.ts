import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "top_up_tag",
    name: "Top-up Tag",
    description: "Create up to 2 Common Jokers (must have room)",
    trigger: "immediate",
    effect: {
      kind: "extra_joker_now",
      rarity: "common"
    }
  };

export default def;

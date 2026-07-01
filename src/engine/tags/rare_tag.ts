import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "rare_tag",
    name: "Rare Tag",
    description: "Shop has a free Rare Joker",
    trigger: "on_shop_enter",
    effect: {
      kind: "extra_joker_now",
      rarity: "rare"
    }
  };

export default def;

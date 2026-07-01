import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "uncommon_tag",
    name: "Uncommon Tag",
    description: "Shop has a free Uncommon Joker",
    trigger: "on_shop_enter",
    effect: {
      kind: "extra_joker_now",
      rarity: "uncommon"
    }
  };

export default def;

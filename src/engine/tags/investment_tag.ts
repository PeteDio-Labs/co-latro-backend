import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "investment_tag",
    name: "Investment Tag",
    description: "After defeating the next Boss Blind, gain $25",
    trigger: "on_shop_enter",
    effect: {
      kind: "money_add",
      n: 25
    }
  };

export default def;

import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "speed_tag",
    name: "Speed Tag",
    description: "Gives $5 per Blind skipped this run",
    trigger: "on_shop_enter",
    effect: {
      kind: "money_add",
      n: 5
    }
  };

export default def;

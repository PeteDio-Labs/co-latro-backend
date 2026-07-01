import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "buffoon_tag",
    name: "Buffoon Tag",
    description: "Gives a free Mega Buffoon Pack",
    trigger: "on_pack_open",
    effect: {
      kind: "free_pack",
      packKind: "buffoon"
    }
  };

export default def;

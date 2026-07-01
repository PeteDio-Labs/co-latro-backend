import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "charm_tag",
    name: "Charm Tag",
    description: "Gives a free Mega Arcana Pack",
    trigger: "on_pack_open",
    effect: {
      kind: "free_pack",
      packKind: "arcana"
    }
  };

export default def;

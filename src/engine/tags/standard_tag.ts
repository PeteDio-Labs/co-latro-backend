import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "standard_tag",
    name: "Standard Tag",
    description: "Gives a free Mega Standard Pack",
    trigger: "on_pack_open",
    effect: {
      kind: "free_pack",
      packKind: "standard"
    }
  };

export default def;

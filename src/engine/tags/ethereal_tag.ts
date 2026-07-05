import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "ethereal_tag",
    name: "Ethereal Tag",
    description: "Gives a free Spectral Pack",
    trigger: "on_pack_open",
    effect: {
      kind: "free_pack",
      packKind: "spectral"
    }
  };

export default def;

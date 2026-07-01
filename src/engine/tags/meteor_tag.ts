import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "meteor_tag",
    name: "Meteor Tag",
    description: "Gives a free Mega Celestial Pack",
    trigger: "on_pack_open",
    effect: {
      kind: "free_pack",
      packKind: "celestial"
    }
  };

export default def;

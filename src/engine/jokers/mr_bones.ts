import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "mr_bones",
    name: "Mr. Bones",
    description: "+5 Mult",
    cost: 5,
    rarity: "uncommon",
    effect: {
      kind: "flat_mult",
      mult: 5
    }
  };

export default def;

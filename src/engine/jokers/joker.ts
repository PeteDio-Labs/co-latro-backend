import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "joker",
    name: "Joker",
    description: "+4 Mult",
    cost: 2,
    rarity: "common",
    effect: {
      kind: "flat_mult",
      mult: 4
    }
  };

export default def;

import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "bootstraps",
    name: "Bootstraps",
    description: "+2 Mult for every $5 you have",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "per_5_dollars_mult",
      mult: 2
    }
  };

export default def;

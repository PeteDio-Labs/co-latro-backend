import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "bull",
    name: "Bull",
    description: "+2 Mult per $5 held",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "per_5_dollars_mult",
      mult: 2
    }
  };

export default def;

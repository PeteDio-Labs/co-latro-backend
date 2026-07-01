import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "madness",
    name: "Madness",
    description: "+0.5 Mult per blind cleared",
    cost: 7,
    rarity: "uncommon",
    effect: {
      kind: "scaling_per_blind_mult",
      mult: 0.5
    }
  };

export default def;

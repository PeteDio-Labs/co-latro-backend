import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "constellation",
    name: "Constellation",
    description: "+1 Mult per blind cleared",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "scaling_per_blind_mult",
      mult: 1
    }
  };

export default def;

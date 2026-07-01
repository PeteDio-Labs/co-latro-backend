import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "green_joker",
    name: "Green Joker",
    description: "+1 Mult per blind cleared",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "scaling_per_blind_mult",
      mult: 1
    }
  };

export default def;

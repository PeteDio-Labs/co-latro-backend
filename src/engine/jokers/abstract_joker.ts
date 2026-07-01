import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "abstract_joker",
    name: "Abstract Joker",
    description: "+3 Mult per Joker owned",
    cost: 4,
    rarity: "uncommon",
    effect: {
      kind: "per_joker_mult",
      mult: 3
    }
  };

export default def;

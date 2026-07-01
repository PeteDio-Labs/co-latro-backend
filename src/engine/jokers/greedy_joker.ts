import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "greedy_joker",
    name: "Greedy Joker",
    description: "+3 Mult per ♦ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_mult",
      suit: "diamonds",
      mult: 3
    }
  };

export default def;

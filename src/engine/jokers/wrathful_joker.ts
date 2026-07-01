import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "wrathful_joker",
    name: "Wrathful Joker",
    description: "+3 Mult per ♠ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_mult",
      suit: "spades",
      mult: 3
    }
  };

export default def;

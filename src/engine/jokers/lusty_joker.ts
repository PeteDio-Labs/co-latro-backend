import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "lusty_joker",
    name: "Lusty Joker",
    description: "+3 Mult per ♥ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_mult",
      suit: "hearts",
      mult: 3
    }
  };

export default def;

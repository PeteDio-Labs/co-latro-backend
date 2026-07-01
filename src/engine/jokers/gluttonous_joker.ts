import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "gluttonous_joker",
    name: "Gluttonous Joker",
    description: "+3 Mult per ♣ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_mult",
      suit: "clubs",
      mult: 3
    }
  };

export default def;

import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "icy_joker",
    name: "Icy Joker",
    description: "+4 Mult per ♣ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_mult",
      suit: "clubs",
      mult: 4
    }
  };

export default def;

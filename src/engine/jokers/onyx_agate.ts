import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "onyx_agate",
    name: "Onyx Agate",
    description: "+7 Mult per ♣ scored",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "per_suit_mult",
      suit: "clubs",
      mult: 7
    }
  };

export default def;

import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "onyx_chips",
    name: "Onyx Chips",
    description: "+30 Chips per club scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_chips",
      suit: "clubs",
      chips: 30
    }
};

export default def;

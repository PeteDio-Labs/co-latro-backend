import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "amber_chips",
    name: "Amber Chips",
    description: "+40 Chips per ♦ scored",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_suit_chips",
      suit: "diamonds",
      chips: 40
    }
};

export default def;

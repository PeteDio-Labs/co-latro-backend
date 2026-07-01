import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "clever_joker",
    name: "Clever Joker",
    description: "+80 Chips if hand has Two Pair",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_chips",
      feature: "two_pair",
      chips: 80
    }
  };

export default def;

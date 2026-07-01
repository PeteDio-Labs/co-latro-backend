import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "sly_joker",
    name: "Sly Joker",
    description: "+50 Chips if hand has a Pair",
    cost: 3,
    rarity: "common",
    effect: {
      kind: "contains_chips",
      feature: "pair",
      chips: 50
    }
  };

export default def;

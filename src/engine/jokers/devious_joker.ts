import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "devious_joker",
    name: "Devious Joker",
    description: "+100 Chips if hand has a Straight",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "contains_chips",
      feature: "straight",
      chips: 100
    }
  };

export default def;
